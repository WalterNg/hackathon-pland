from __future__ import annotations

from datetime import datetime
from typing import Any

from schemas.achievement import AchievementDefinition


class PortfolioAchievementEvaluator:
    def _metric_value(self, metric: str, snapshot_payload: dict[str, Any]) -> float | None:
        summary = snapshot_payload.get("summary") if isinstance(snapshot_payload.get("summary"), dict) else {}
        metrics = snapshot_payload.get("metrics") if isinstance(snapshot_payload.get("metrics"), dict) else {}
        assets = snapshot_payload.get("assets") if isinstance(snapshot_payload.get("assets"), list) else []

        if metric == "distinct_assets":
            symbols: set[str] = set()
            for item in assets:
                if not isinstance(item, dict):
                    continue
                symbol = str(item.get("symbol", "")).strip().upper()
                quantity = float(item.get("quantity", 0) or 0)
                if symbol and quantity > 0:
                    symbols.add(symbol)
            return float(len(symbols))

        if metric == "total_value_usd":
            value = summary.get("totalValueUsd")
            return float(value) if value is not None else None

        if metric == "max_drawdown_percent":
            value = metrics.get("maxDrawdownPercent")
            return float(value) if value is not None else None

        if metric == "sharpe_ratio_30d":
            value = metrics.get("sharpeRatio30d")
            return float(value) if value is not None else None

        return None

    def _matches(self, operator: str, value: float, threshold: float) -> bool:
        if operator == "gte":
            return value >= threshold
        if operator == "lte":
            return value <= threshold
        return False

    def evaluate(
        self,
        definitions: list[AchievementDefinition],
        snapshot_payload: dict[str, Any],
    ) -> list[tuple[AchievementDefinition, float]]:
        matches: list[tuple[AchievementDefinition, float]] = []
        for definition in definitions:
            metric_value = self._metric_value(definition.metric, snapshot_payload)
            if metric_value is None:
                continue
            if self._matches(definition.operator, metric_value, float(definition.threshold)):
                matches.append((definition, metric_value))
        return matches


def snapshot_time(snapshot_payload: dict[str, Any], fallback: datetime) -> datetime:
    summary = snapshot_payload.get("summary") if isinstance(snapshot_payload.get("summary"), dict) else {}
    raw_timestamp = summary.get("timestamp")
    if isinstance(raw_timestamp, str) and raw_timestamp.strip():
        try:
            return datetime.fromisoformat(raw_timestamp.replace("Z", "+00:00"))
        except ValueError:
            return fallback
    return fallback
