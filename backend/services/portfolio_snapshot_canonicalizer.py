from __future__ import annotations

from copy import deepcopy
from typing import Any

from schemas.portfolio_snapshot_certificate import CanonicalPortfolioSnapshotPayload


def _sort_dict(value: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key in sorted(value.keys()):
        normalized[key] = _normalize_value(value[key])
    return normalized


def _sort_assets(assets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        _sort_dict(asset)
        for asset in sorted(
            assets,
            key=lambda item: (
                str(item.get("symbol", "")).upper(),
                float(item.get("quantity", 0) or 0),
            ),
        )
    ]


def _sort_chart(chart: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        _sort_dict(point)
        for point in sorted(chart, key=lambda item: str(item.get("time", "")))
    ]


def _sort_risk_violations(violations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        _sort_dict(violation)
        for violation in sorted(
            violations,
            key=lambda item: (
                str(item.get("occurredAt", "")),
                str(item.get("eventType", "")),
                str(item.get("symbol", "")),
            ),
        )
    ]


def _normalize_value(value: Any) -> Any:
    if isinstance(value, dict):
        return _sort_dict(value)
    if isinstance(value, list):
        return [_normalize_value(item) for item in value]
    return value


def canonicalize_portfolio_snapshot(snapshot: dict[str, Any]) -> CanonicalPortfolioSnapshotPayload:
    payload = deepcopy(snapshot)

    if not isinstance(payload, dict):
        raise ValueError("Snapshot payload must be an object.")

    summary = payload.get("summary")
    metrics = payload.get("metrics")
    chart = payload.get("chart")
    assets = payload.get("assets")
    risk_violations = payload.get("riskViolations") or payload.get("risk_violations") or []

    if not isinstance(summary, dict) or not isinstance(metrics, dict):
        raise ValueError("Snapshot payload must contain summary and metrics objects.")
    if not isinstance(chart, list) or not isinstance(assets, list):
        raise ValueError("Snapshot payload must contain chart and assets arrays.")
    if not isinstance(risk_violations, list):
        raise ValueError("Snapshot payload risk violations must be a list.")

    canonical_payload = CanonicalPortfolioSnapshotPayload(
        summary=_sort_dict(summary),
        metrics=_sort_dict(metrics),
        chart=_sort_chart([item for item in chart if isinstance(item, dict)]),
        assets=_sort_assets([item for item in assets if isinstance(item, dict)]),
        riskViolations=_sort_risk_violations([item for item in risk_violations if isinstance(item, dict)]),
    )

    return canonical_payload
