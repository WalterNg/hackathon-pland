from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from schemas.input import PortfolioForecastPayload
from schemas.output import PortfolioForecastAssetProjection, PortfolioForecastData
from services.portfolio_snapshot import normalize_symbol


class ForecastUnavailableError(RuntimeError):
    """Raised when the portfolio forecast artifact cannot be loaded or used."""


@dataclass(frozen=True)
class ForecastArtifact:
    """In-memory representation of the latest forecast artifact."""

    artifact_timestamp: str
    horizon_hours: int
    predictions_by_symbol: dict[str, float]
    forecast_band_error_pct: float
    confidence_score: int
    model_status: str
    training_state: str
    status_message: str

    @property
    def is_ready(self) -> bool:
        return self.model_status == "ready" and self.training_state == "succeeded"


def _artifact_path() -> Path:
    return Path(__file__).resolve().parent / "freqai" / "artifacts" / "latest_manifest.json"


def _to_float(value: Any, fallback: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return number if number == number else fallback


def _to_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


@lru_cache(maxsize=1)
def load_forecast_artifact() -> ForecastArtifact:
    """Load the latest forecast artifact from disk and cache it in memory."""

    path = _artifact_path()
    if not path.exists():
        raise ForecastUnavailableError(f"Forecast artifact not found at {path}.")

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - defensive parsing guard
        raise ForecastUnavailableError(f"Unable to parse forecast artifact: {exc}") from exc

    predictions_by_symbol = {
        str(symbol).upper().strip(): _to_float(prediction)
        for symbol, prediction in (payload.get("predictions_by_symbol") or {}).items()
    }

    return ForecastArtifact(
        artifact_timestamp=str(payload.get("artifact_timestamp") or payload.get("last_training_completed_at") or ""),
        horizon_hours=_to_int(payload.get("horizon_hours"), 48),
        predictions_by_symbol=predictions_by_symbol,
        forecast_band_error_pct=max(0.0, _to_float(payload.get("forecast_band_error_pct"), 0.05)),
        confidence_score=max(1, min(10, _to_int(payload.get("confidence_score"), 1))),
        model_status=str(payload.get("model_status") or "unavailable"),
        training_state=str(payload.get("training_state") or "unknown"),
        status_message=str(payload.get("status_message") or "Forecast artifact loaded."),
    )


class PortfolioForecastService:
    """Build a portfolio value forecast from the latest FreqAI artifact."""

    def __init__(self) -> None:
        self._artifact: ForecastArtifact | None = None

    def _get_artifact(self) -> ForecastArtifact:
        if self._artifact is None:
            self._artifact = load_forecast_artifact()
        return self._artifact

    def predict(self, payload: PortfolioForecastPayload) -> PortfolioForecastData:
        """Forecast the current portfolio value using the cached artifact."""

        artifact = self._get_artifact()
        if not artifact.is_ready:
            raise ForecastUnavailableError(artifact.status_message or "Forecast artifact is not ready.")

        positions = [
            {
                "symbol": normalize_symbol(item.asset),
                "current_value_usd": _to_float(item.amount) * _to_float(item.current_price),
            }
            for item in payload.portfolio
            if _to_float(item.amount) > 0 and _to_float(item.current_price) > 0
        ]

        current_value = sum(position["current_value_usd"] for position in positions) + _to_float(payload.stablecoin_reserve)
        if current_value <= 0:
            raise ForecastUnavailableError("Portfolio must contain at least one positive-value asset.")

        asset_breakdown: list[PortfolioForecastAssetProjection] = []
        weighted_return_sum = 0.0
        covered_value = 0.0

        for position in positions:
            symbol = position["symbol"]
            current_value_usd = position["current_value_usd"]
            predicted_return_pct = artifact.predictions_by_symbol.get(symbol, 0.0)
            forecast_value_usd = current_value_usd * (1.0 + predicted_return_pct)
            change_abs_usd = forecast_value_usd - current_value_usd
            weight_pct = current_value_usd / current_value if current_value > 0 else 0.0
            weighted_return_sum += weight_pct * predicted_return_pct
            if symbol in artifact.predictions_by_symbol:
                covered_value += current_value_usd

            asset_breakdown.append(
                PortfolioForecastAssetProjection(
                    symbol=symbol,
                    current_value_usd=round(current_value_usd, 2),
                    predicted_return_pct=round(predicted_return_pct * 100.0, 2),
                    forecast_value_usd=round(forecast_value_usd, 2),
                    change_abs_usd=round(change_abs_usd, 2),
                    contribution_pct=round(weight_pct * predicted_return_pct * 100.0, 4),
                )
            )

        forecast_change_pct = weighted_return_sum * 100.0
        forecast_portfolio_value = current_value * (1.0 + weighted_return_sum)
        change_abs = forecast_portfolio_value - current_value
        band_error = artifact.forecast_band_error_pct

        lower = max(0.0, forecast_portfolio_value * (1.0 - band_error))
        upper = max(lower, forecast_portfolio_value * (1.0 + band_error))
        coverage_ratio = covered_value / current_value if current_value > 0 else 0.0
        confidence_score = max(1, min(10, round(artifact.confidence_score * max(0.25, coverage_ratio))))

        return PortfolioForecastData(
            status="ready",
            horizon_hours=artifact.horizon_hours,
            forecast_portfolio_value=round(forecast_portfolio_value, 2),
            forecast_lower=round(lower, 2),
            forecast_upper=round(upper, 2),
            forecast_change_abs=round(change_abs, 2),
            forecast_change_pct=round(forecast_change_pct, 2),
            confidence_score=confidence_score,
            artifact_timestamp=artifact.artifact_timestamp,
            predictions_by_symbol={
                symbol: round(value * 100.0, 2)
                for symbol, value in artifact.predictions_by_symbol.items()
            },
            asset_breakdown=asset_breakdown,
        )
