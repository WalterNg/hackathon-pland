from __future__ import annotations

import asyncio
import hashlib
import logging
import random
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx

from schemas.input import PortfolioForecastPayload
from schemas.output import (
    PortfolioForecastAssetProjection,
    PortfolioForecastCoverageSummary,
    PortfolioForecastData,
    PortfolioForecastPath,
    PortfolioForecastPoint,
    PortfolioForecastStepDistribution,
)

logger = logging.getLogger("hackathon-pland")

DEFAULT_HORIZON_HOURS = 48
DEFAULT_STEP_HOURS = 1
DEFAULT_SIMULATION_COUNT = 600
DEFAULT_LOOKBACK_HOURS = 24 * 30
DEFAULT_TIMEOUT_SECONDS = 15.0
DEFAULT_CACHE_TTL_SECONDS = 300
MIN_REQUIRED_RETURNS = 72
DEMO_BASE_URL = "https://demo-api.binance.com"
STABLE_ASSET_SYMBOLS = {
    "USDT",
    "USDC",
    "BUSD",
    "FDUSD",
    "TUSD",
    "DAI",
    "USDP",
    "USDS",
    "PYUSD",
}
RESERVE_SYMBOL = "__RESERVE__"


class ForecastUnavailableError(RuntimeError):
    """Raised when the portfolio forecast cannot be simulated safely."""


@dataclass(frozen=True)
class ForecastPosition:
    """Normalized position used by the Monte Carlo engine."""

    input_symbol: str
    symbol: str
    current_value_usd: float
    is_stablecoin: bool


@dataclass(frozen=True)
class ForecastCacheEntry:
    """In-memory cache entry for simulated forecasts."""

    expires_at_monotonic: float
    data: PortfolioForecastData


@dataclass(frozen=True)
class ScenarioPath:
    """Single simulated portfolio path."""

    values: tuple[float, ...]
    terminal_value: float
    asset_terminal_values: dict[str, float]


@dataclass(frozen=True)
class HistoricalReturnsDataset:
    """Aligned hourly returns used for joint bootstrap sampling."""

    timestamps: tuple[int, ...]
    returns_by_symbol: dict[str, tuple[float, ...]]

    @property
    def row_count(self) -> int:
        """Return the number of aligned historical return rows."""
        return len(self.timestamps)


def _round(value: float, digits: int = 2) -> float:
    """Round a numeric value to a predictable number of decimals."""

    return round(float(value), digits)


def _clamp(value: float, low: float, high: float) -> float:
    """Clamp a numeric value into an inclusive interval."""

    return max(low, min(high, value))


def _quantile(values: list[float], percentile: float) -> float:
    """Compute a linear-interpolated percentile for a non-empty value list."""

    if not values:
        return 0.0

    if len(values) == 1:
        return values[0]

    position = _clamp(percentile, 0.0, 1.0) * (len(values) - 1)
    lower_index = int(position)
    upper_index = min(lower_index + 1, len(values) - 1)
    weight = position - lower_index
    return values[lower_index] * (1.0 - weight) + values[upper_index] * weight


def _base_asset(symbol: str) -> str:
    """Extract the base asset from a raw or USDT-quoted symbol."""

    normalized = symbol.upper().strip()
    if normalized.endswith("USDT") and len(normalized) > 4:
        return normalized[:-4]
    return normalized


def _is_stablecoin_symbol(symbol: str) -> bool:
    """Return whether a symbol should be treated as stable for simulation."""

    return _base_asset(symbol) in STABLE_ASSET_SYMBOLS


def _normalize_forecast_symbol(symbol: str) -> str:
    """Normalize a symbol into the market-history symbol used by the forecast."""

    normalized = symbol.upper().strip()
    if _is_stablecoin_symbol(normalized):
        return normalized
    if normalized.endswith("USDT"):
        return normalized
    return f"{normalized}USDT"


def _build_cache_key(payload: PortfolioForecastPayload) -> str:
    """Build a deterministic cache key for the supplied forecast payload."""

    normalized_positions = [
        (
            _normalize_forecast_symbol(item.asset),
            round(float(item.amount), 8),
            round(float(item.current_price), 8),
        )
        for item in payload.portfolio
        if float(item.amount) > 0 and float(item.current_price) > 0
    ]
    normalized_positions.sort(key=lambda item: item[0])
    cache_basis = {
        "user_id": payload.user_id,
        "positions": normalized_positions,
        "stablecoin_reserve": round(float(payload.stablecoin_reserve), 8),
        "horizon_hours": DEFAULT_HORIZON_HOURS,
        "step_hours": DEFAULT_STEP_HOURS,
        "simulation_count": DEFAULT_SIMULATION_COUNT,
        "lookback_hours": DEFAULT_LOOKBACK_HOURS,
    }
    encoded = repr(cache_basis).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _seed_from_cache_key(cache_key: str) -> int:
    """Derive a stable integer seed from a cache key."""

    return int(cache_key[:16], 16)


def _normalize_positions(payload: PortfolioForecastPayload) -> list[ForecastPosition]:
    """Convert the request payload into normalized forecast positions."""

    positions: list[ForecastPosition] = []
    for item in payload.portfolio:
        amount = float(item.amount)
        current_price = float(item.current_price)
        if amount <= 0 or current_price <= 0:
            continue

        input_symbol = item.asset.upper().strip()
        symbol = _normalize_forecast_symbol(input_symbol)
        positions.append(
            ForecastPosition(
                input_symbol=input_symbol,
                symbol=symbol,
                current_value_usd=amount * current_price,
                is_stablecoin=_is_stablecoin_symbol(input_symbol),
            )
        )
    return positions


class PortfolioForecastService:
    """Simulate a portfolio value forecast from recent hourly market history."""

    def __init__(self) -> None:
        self._cache: dict[str, ForecastCacheEntry] = {}
        self._timeout = DEFAULT_TIMEOUT_SECONDS

    def _get_cached(self, cache_key: str) -> PortfolioForecastData | None:
        """Return a cached forecast when it is still fresh."""

        entry = self._cache.get(cache_key)
        if entry is None:
            return None
        if datetime.now(UTC).timestamp() >= entry.expires_at_monotonic:
            self._cache.pop(cache_key, None)
            return None
        return entry.data

    def _store_cached(self, cache_key: str, data: PortfolioForecastData) -> None:
        """Store a forecast result in the short-lived in-memory cache."""

        self._cache[cache_key] = ForecastCacheEntry(
            expires_at_monotonic=datetime.now(UTC).timestamp() + DEFAULT_CACHE_TTL_SECONDS,
            data=data,
        )

    async def _fetch_hourly_klines(self, symbol: str) -> list[dict[str, float]]:
        """Fetch hourly klines for one symbol from the existing market source."""

        if _is_stablecoin_symbol(symbol):
            return []

        params = {
            "symbol": symbol,
            "interval": "1h",
            "limit": DEFAULT_LOOKBACK_HOURS,
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(f"{DEMO_BASE_URL}/api/v3/klines", params=params)
                response.raise_for_status()
        except Exception as exc:
            logger.warning("Forecast history fetch failed for %s: %s", symbol, exc)
            return []

        rows = response.json()
        return [
            {
                "open_time": int(row[0]),
                "close_price": float(row[4]),
            }
            for row in rows
            if len(row) > 4 and float(row[4]) > 0
        ]

    async def _load_historical_returns(
        self,
        covered_symbols: list[str],
    ) -> HistoricalReturnsDataset:
        """Fetch and align hourly historical returns for all covered symbols."""

        fetched_histories = await asyncio.gather(
            *(self._fetch_hourly_klines(symbol) for symbol in covered_symbols)
        )
        history_by_symbol = dict(zip(covered_symbols, fetched_histories, strict=True))

        per_symbol_returns: dict[str, dict[int, float]] = {}
        shared_timestamps: set[int] | None = None

        for symbol, rows in history_by_symbol.items():
            if len(rows) < MIN_REQUIRED_RETURNS + 1:
                continue

            symbol_returns: dict[int, float] = {}
            for previous, current in zip(rows, rows[1:]):
                previous_close = previous["close_price"]
                current_close = current["close_price"]
                if previous_close <= 0 or current_close <= 0:
                    continue
                symbol_returns[int(current["open_time"])] = (current_close / previous_close) - 1.0

            if len(symbol_returns) < MIN_REQUIRED_RETURNS:
                continue

            per_symbol_returns[symbol] = symbol_returns
            current_timestamps = set(symbol_returns)
            shared_timestamps = current_timestamps if shared_timestamps is None else shared_timestamps & current_timestamps

        if not per_symbol_returns or not shared_timestamps:
            raise ForecastUnavailableError("Not enough hourly market history is available for Monte Carlo simulation.")

        aligned_timestamps = tuple(sorted(shared_timestamps))
        if len(aligned_timestamps) < MIN_REQUIRED_RETURNS:
            raise ForecastUnavailableError("Hourly market history overlap is too small for Monte Carlo simulation.")

        aligned_returns = {
            symbol: tuple(per_symbol_returns[symbol][timestamp] for timestamp in aligned_timestamps)
            for symbol in per_symbol_returns
        }
        return HistoricalReturnsDataset(
            timestamps=aligned_timestamps,
            returns_by_symbol=aligned_returns,
        )

    def _simulate_paths(
        self,
        positions: list[ForecastPosition],
        historical_returns: HistoricalReturnsDataset,
        current_value: float,
        seed: int,
    ) -> list[ScenarioPath]:
        """Generate Monte Carlo scenario paths from aligned historical returns."""

        rng = random.Random(seed)
        covered_symbols = list(historical_returns.returns_by_symbol)
        starting_asset_values = {position.symbol: position.current_value_usd for position in positions}
        scenarios: list[ScenarioPath] = []

        for _ in range(DEFAULT_SIMULATION_COUNT):
            portfolio_value = current_value
            asset_values = dict(starting_asset_values)
            path_values = [current_value]

            for _step in range(DEFAULT_HORIZON_HOURS):
                row_index = rng.randrange(historical_returns.row_count)
                for symbol in covered_symbols:
                    asset_values[symbol] *= 1.0 + historical_returns.returns_by_symbol[symbol][row_index]
                portfolio_value = sum(asset_values.values())
                path_values.append(portfolio_value)

            scenarios.append(
                ScenarioPath(
                    values=tuple(path_values),
                    terminal_value=portfolio_value,
                    asset_terminal_values=asset_values,
                )
            )

        return scenarios

    def _build_flat_scenarios(self, current_value: float, positions: list[ForecastPosition]) -> list[ScenarioPath]:
        """Build deterministic flat scenarios when no volatile assets are present."""

        starting_asset_values = {position.symbol: position.current_value_usd for position in positions}
        flat_values = tuple(current_value for _ in range(DEFAULT_HORIZON_HOURS + 1))
        return [
            ScenarioPath(
                values=flat_values,
                terminal_value=current_value,
                asset_terminal_values=dict(starting_asset_values),
            )
            for _ in range(DEFAULT_SIMULATION_COUNT)
        ]

    def _build_path_points(self, values: list[float]) -> list[PortfolioForecastPoint]:
        """Convert raw path values into API point objects."""

        return [
            PortfolioForecastPoint(
                hour_offset=hour_offset,
                value_usd=_round(value),
            )
            for hour_offset, value in enumerate(values)
        ]

    def _build_sample_paths(self, scenarios: list[ScenarioPath]) -> list[PortfolioForecastPath]:
        """Select representative simulated paths for visualization."""

        ranked = sorted(scenarios, key=lambda scenario: scenario.terminal_value)
        quantiles = [
            ("Downside", 0.10),
            ("Lower-mid", 0.30),
            ("Base", 0.50),
            ("Upper-mid", 0.70),
            ("Upside", 0.90),
        ]
        paths: list[PortfolioForecastPath] = []
        for label, percentile in quantiles:
            index = int(round((len(ranked) - 1) * percentile))
            selected = ranked[index]
            paths.append(
                PortfolioForecastPath(
                    label=label,
                    terminal_value_usd=_round(selected.terminal_value),
                    points=self._build_path_points(list(selected.values)),
                )
            )
        return paths

    def _build_percentile_paths(
        self,
        scenarios: list[ScenarioPath],
    ) -> dict[float, list[PortfolioForecastPoint]]:
        """Compute percentile paths across all simulated steps."""

        path_length = len(scenarios[0].values)
        percentiles = (0.10, 0.50, 0.90)
        values_by_percentile: dict[float, list[float]] = {
            percentile: [] for percentile in percentiles
        }

        for step_index in range(path_length):
            step_values = sorted(scenario.values[step_index] for scenario in scenarios)
            for percentile in percentiles:
                values_by_percentile[percentile].append(
                    _quantile(step_values, percentile)
                )

        return {
            percentile: self._build_path_points(values)
            for percentile, values in values_by_percentile.items()
        }

    def _build_step_distributions(
        self,
        scenarios: list[ScenarioPath],
    ) -> list[PortfolioForecastStepDistribution]:
        """Build sorted per-hour scenario values for tooltip probability lookups."""

        path_length = len(scenarios[0].values)
        distributions: list[PortfolioForecastStepDistribution] = []
        for step_index in range(path_length):
            sorted_values = sorted(
                _round(scenario.values[step_index])
                for scenario in scenarios
            )
            distributions.append(
                PortfolioForecastStepDistribution(
                    hour_offset=step_index,
                    sorted_value_usd=sorted_values,
                )
            )
        return distributions

    def _build_asset_breakdown(
        self,
        positions: list[ForecastPosition],
        scenarios: list[ScenarioPath],
        current_value: float,
    ) -> list[PortfolioForecastAssetProjection]:
        """Build per-asset median contribution data from simulated terminal states."""

        terminal_values_by_symbol: dict[str, list[float]] = {position.symbol: [] for position in positions}
        for scenario in scenarios:
            for symbol, terminal_value in scenario.asset_terminal_values.items():
                terminal_values_by_symbol.setdefault(symbol, []).append(terminal_value)

        asset_breakdown: list[PortfolioForecastAssetProjection] = []
        for position in positions:
            if position.symbol == RESERVE_SYMBOL:
                continue
            terminal_values = sorted(terminal_values_by_symbol.get(position.symbol, [position.current_value_usd]))
            median_terminal = _quantile(terminal_values, 0.50)
            change_abs_usd = median_terminal - position.current_value_usd
            predicted_return_pct = (
                ((median_terminal / position.current_value_usd) - 1.0) * 100.0
                if position.current_value_usd > 0
                else 0.0
            )
            contribution_pct = (change_abs_usd / current_value * 100.0) if current_value > 0 else 0.0
            asset_breakdown.append(
                PortfolioForecastAssetProjection(
                    symbol=position.symbol,
                    current_value_usd=_round(position.current_value_usd),
                    predicted_return_pct=_round(predicted_return_pct),
                    forecast_value_usd=_round(median_terminal),
                    change_abs_usd=_round(change_abs_usd),
                    contribution_pct=_round(contribution_pct, 4),
                )
            )

        asset_breakdown.sort(key=lambda item: abs(item.change_abs_usd), reverse=True)
        return asset_breakdown

    def _build_confidence_score(
        self,
        covered_value: float,
        current_value: float,
        sampled_row_count: int,
    ) -> int:
        """Estimate a simple confidence score from data coverage and history depth."""

        covered_value_ratio = covered_value / current_value if current_value > 0 else 0.0
        history_ratio = min(1.0, sampled_row_count / 240.0)
        score_ratio = covered_value_ratio * history_ratio
        return max(1, min(10, round(1.0 + score_ratio * 9.0)))

    async def predict(self, payload: PortfolioForecastPayload) -> PortfolioForecastData:
        """Forecast the portfolio value with a cached historical Monte Carlo engine."""

        positions = _normalize_positions(payload)
        reserve_value = float(payload.stablecoin_reserve)
        if reserve_value > 0:
            positions.append(
                ForecastPosition(
                    input_symbol=RESERVE_SYMBOL,
                    symbol=RESERVE_SYMBOL,
                    current_value_usd=reserve_value,
                    is_stablecoin=True,
                )
            )

        current_value = sum(position.current_value_usd for position in positions)
        if current_value <= 0:
            raise ForecastUnavailableError("Portfolio must contain at least one positive-value asset.")

        cache_key = _build_cache_key(payload)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        covered_positions = [position for position in positions if not position.is_stablecoin]
        covered_symbols = sorted({position.symbol for position in covered_positions})
        simulated_symbols: set[str] = set()
        uncovered_symbols: list[str] = []

        if covered_symbols:
            historical_returns = await self._load_historical_returns(covered_symbols)
            simulated_symbols = set(historical_returns.returns_by_symbol)
            uncovered_symbols = sorted({position.symbol for position in positions if position.symbol not in simulated_symbols and position.symbol != RESERVE_SYMBOL})
            scenarios = self._simulate_paths(
                positions=positions,
                historical_returns=historical_returns,
                current_value=current_value,
                seed=_seed_from_cache_key(cache_key),
            )
            sampled_row_count = historical_returns.row_count
        else:
            historical_returns = None
            uncovered_symbols = []
            scenarios = self._build_flat_scenarios(current_value=current_value, positions=positions)
            sampled_row_count = 0

        covered_value = sum(position.current_value_usd for position in positions if position.symbol in simulated_symbols or position.is_stablecoin)
        terminal_values = sorted(scenario.terminal_value for scenario in scenarios)

        percentile_paths = self._build_percentile_paths(scenarios)
        p10_value = _quantile(terminal_values, 0.10)
        p50_value = _quantile(terminal_values, 0.50)
        p90_value = _quantile(terminal_values, 0.90)
        forecast_change_abs = p50_value - current_value
        forecast_change_pct = ((p50_value / current_value) - 1.0) * 100.0 if current_value > 0 else 0.0
        generated_at = datetime.now(UTC).isoformat()

        data = PortfolioForecastData(
            status="ready",
            horizon_hours=DEFAULT_HORIZON_HOURS,
            forecast_portfolio_value=_round(p50_value),
            forecast_lower=_round(p10_value),
            forecast_upper=_round(p90_value),
            forecast_change_abs=_round(forecast_change_abs),
            forecast_change_pct=_round(forecast_change_pct),
            confidence_score=self._build_confidence_score(
                covered_value=covered_value,
                current_value=current_value,
                sampled_row_count=sampled_row_count,
            ),
            generated_at=generated_at,
            simulation_count=DEFAULT_SIMULATION_COUNT,
            step_hours=DEFAULT_STEP_HOURS,
            sample_paths=self._build_sample_paths(scenarios),
            step_distributions=self._build_step_distributions(scenarios),
            percentile_path_p10=percentile_paths[0.10],
            percentile_path_p50=percentile_paths[0.50],
            percentile_path_p90=percentile_paths[0.90],
            coverage_summary=PortfolioForecastCoverageSummary(
                covered_symbols=sorted(simulated_symbols),
                uncovered_symbols=uncovered_symbols,
                covered_value_ratio=_round(covered_value / current_value * 100.0 if current_value > 0 else 0.0, 2),
                sampled_row_count=sampled_row_count,
                lookback_hours=DEFAULT_LOOKBACK_HOURS,
            ),
            asset_breakdown=self._build_asset_breakdown(
                positions=positions,
                scenarios=scenarios,
                current_value=current_value,
            ),
        )
        self._store_cached(cache_key, data)
        return data
