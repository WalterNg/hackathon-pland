from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from services.supabase_rest import (
    SupabaseRestError,
    build_filter_eq,
    build_filter_is_null,
    build_filter_limit,
    build_filter_order,
    build_filter_select,
    fetch_authenticated_user,
    insert_row,
    select_rows,
    update_rows,
)
from services.portfolio_snapshot_certificate_store import resolve_portfolio

router = APIRouter()
logger = logging.getLogger("hackathon-pland")

PROFILE_SELECT = (
    "id,user_id,portfolio_id,name,max_daily_loss_usd,max_position_size_pct,"
    "max_leverage,max_drawdown_pct,risk_per_trade_pct,is_active,updated_at"
)
ALERT_SELECT = (
    "id,portfolio_id,risk_profile_id,event_type,severity,status,title,message,"
    "observed_value,threshold_value,symbol,signature,trigger_count,"
    "first_triggered_at,last_triggered_at,acknowledged_at,resolved_at"
)
EVENT_SELECT = "id,event_type,severity,details,occurred_at"


# ─── Pydantic models ──────────────────────────────────────────────────────────

class RiskRulesPayload(BaseModel):
    maxDrawdownPct: float | None = None
    maxPositionSizePct: float | None = None
    maxDailyLossUsd: float | None = None


class AlertStatusUpdate(BaseModel):
    status: Literal["acknowledged", "resolved"]


class SnapshotMetrics(BaseModel):
    maxDrawdownPercent: float = 0.0
    riskScore: float = 0.0


class SnapshotAsset(BaseModel):
    symbol: str
    allocationPercent: float = 0.0


class SnapshotChartPoint(BaseModel):
    totalValueUsd: float = 0.0


class EvaluateSnapshot(BaseModel):
    metrics: SnapshotMetrics = Field(default_factory=SnapshotMetrics)
    assets: list[SnapshotAsset] = Field(default_factory=list)
    chart: list[SnapshotChartPoint] = Field(default_factory=list)


class EvaluatePayload(BaseModel):
    portfolioName: str
    snapshot: EvaluateSnapshot


# ─── Auth helpers ─────────────────────────────────────────────────────────────

def _extract_bearer_token(authorization: str | None) -> str:
    value = (authorization or "").strip()
    if not value.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = value[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return token


async def _require_user_id(authorization: str | None) -> str:
    token = _extract_bearer_token(authorization)
    try:
        user = await fetch_authenticated_user(token)
    except SupabaseRestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    user_id = str(user.get("id", "")).strip() if isinstance(user, dict) else ""
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user_id


async def _require_portfolio(user_id: str, portfolio_name: str) -> dict[str, Any]:
    portfolio = await resolve_portfolio(user_id, portfolio_name=portfolio_name)
    if not portfolio or not portfolio.get("id"):
        raise HTTPException(status_code=404, detail="Portfolio not found.")
    return portfolio


# ─── Row conversion helpers ───────────────────────────────────────────────────

def _row_to_profile(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "userId": row.get("user_id"),
        "portfolioId": row.get("portfolio_id"),
        "name": row.get("name"),
        "maxDailyLossUsd": row.get("max_daily_loss_usd"),
        "maxPositionSizePct": row.get("max_position_size_pct"),
        "maxLeverage": row.get("max_leverage"),
        "maxDrawdownPct": row.get("max_drawdown_pct"),
        "riskPerTradePct": row.get("risk_per_trade_pct"),
        "isActive": row.get("is_active", True),
        "updatedAt": row.get("updated_at"),
    }


def _row_to_alert(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "portfolioId": row.get("portfolio_id"),
        "riskProfileId": row.get("risk_profile_id"),
        "eventType": row.get("event_type"),
        "severity": row.get("severity"),
        "status": row.get("status"),
        "title": row.get("title"),
        "message": row.get("message"),
        "observedValue": row.get("observed_value"),
        "thresholdValue": row.get("threshold_value"),
        "symbol": row.get("symbol"),
        "signature": row.get("signature"),
        "triggerCount": max(1, int(row.get("trigger_count") or 1)),
        "firstTriggeredAt": row.get("first_triggered_at"),
        "lastTriggeredAt": row.get("last_triggered_at"),
        "acknowledgedAt": row.get("acknowledged_at"),
        "resolvedAt": row.get("resolved_at"),
    }


def _row_to_event(row: dict[str, Any]) -> dict[str, Any]:
    details = row.get("details") or {}
    if not isinstance(details, dict):
        details = {}
    return {
        "id": row.get("id"),
        "eventType": row.get("event_type"),
        "severity": row.get("severity"),
        "details": details,
        "occurredAt": row.get("occurred_at"),
    }


# ─── Risk evaluation helpers ──────────────────────────────────────────────────

def _select_severity(observed: float, threshold: float) -> str:
    if threshold <= 0:
        return "warning"
    if observed >= threshold * 1.25:
        return "critical"
    return "warning"


async def _get_active_profile(user_id: str, portfolio_id: str) -> dict[str, Any] | None:
    """Try portfolio-specific profile first, then fall back to global."""
    rows = await select_rows(
        "risk_profiles",
        params=[
            build_filter_select(PROFILE_SELECT),
            build_filter_eq("user_id", user_id),
            build_filter_eq("portfolio_id", portfolio_id),
            build_filter_eq("is_active", "true"),
            build_filter_order("updated_at", ascending=False),
            build_filter_limit(1),
        ],
    )
    if isinstance(rows, list) and rows:
        return rows[0]

    # Fall back to global profile (portfolio_id is null)
    rows = await select_rows(
        "risk_profiles",
        params=[
            build_filter_select(PROFILE_SELECT),
            build_filter_eq("user_id", user_id),
            build_filter_is_null("portfolio_id"),
            build_filter_eq("is_active", "true"),
            build_filter_order("updated_at", ascending=False),
            build_filter_limit(1),
        ],
    )
    if isinstance(rows, list) and rows:
        return rows[0]
    return None


async def _log_event_if_changed(
    *,
    user_id: str,
    portfolio_id: str,
    risk_profile_id: str,
    event_type: str,
    severity: str,
    details: dict[str, Any],
    cooldown_minutes: int = 15,
) -> bool:
    """Insert a risk event only if not within the cooldown window for the same signature."""
    latest_rows = await select_rows(
        "risk_events",
        params=[
            build_filter_select("id,occurred_at,details"),
            build_filter_eq("user_id", user_id),
            build_filter_eq("portfolio_id", portfolio_id),
            build_filter_eq("event_type", event_type),
            build_filter_order("occurred_at", ascending=False),
            build_filter_limit(1),
        ],
    )
    latest = latest_rows[0] if isinstance(latest_rows, list) and latest_rows else None

    if latest and isinstance(latest, dict):
        try:
            occurred_ts = datetime.fromisoformat(
                str(latest.get("occurred_at", "")).replace("Z", "+00:00")
            ).timestamp()
        except Exception:
            occurred_ts = 0.0
        now_ts = datetime.now(timezone.utc).timestamp()
        in_cooldown = (now_ts - occurred_ts) <= cooldown_minutes * 60

        latest_details = latest.get("details") or {}
        if isinstance(latest_details, dict):
            if in_cooldown and latest_details.get("signature") == details.get("signature"):
                return False

    await insert_row("risk_events", {
        "user_id": user_id,
        "portfolio_id": portfolio_id,
        "risk_profile_id": risk_profile_id,
        "event_type": event_type,
        "severity": severity,
        "details": details,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    })
    return True


async def _resolve_stale_alerts(
    user_id: str,
    portfolio_id: str,
    now_iso: str,
    current_signatures: set[str],
) -> None:
    """Auto-resolve active alerts whose rule is no longer violated."""
    active_rows = await select_rows(
        "risk_alerts",
        params=[
            build_filter_select("id,signature"),
            build_filter_eq("user_id", user_id),
            build_filter_eq("portfolio_id", portfolio_id),
            build_filter_eq("status", "active"),
            build_filter_limit(100),
        ],
    )
    for row in (active_rows or []):
        if not isinstance(row, dict):
            continue
        if row.get("signature") not in current_signatures:
            await update_rows(
                "risk_alerts",
                params=[
                    build_filter_eq("id", str(row["id"])),
                    build_filter_eq("user_id", user_id),
                ],
                updates={"status": "resolved", "resolved_at": now_iso},
            )


# ─── GET /api/risk-rules/rules ────────────────────────────────────────────────

@router.get("/risk-rules/rules")
async def get_risk_rules(
    portfolioName: str = Query(default="Main Portfolio"),
    authorization: str | None = Header(default=None),
):
    user_id = await _require_user_id(authorization)
    portfolio = await _require_portfolio(user_id, portfolioName)
    portfolio_id = str(portfolio["id"])

    profile_row = await _get_active_profile(user_id, portfolio_id)
    if not profile_row:
        return {"profile": None, "source": "none"}

    source = "portfolio" if profile_row.get("portfolio_id") else "global"
    return {"profile": _row_to_profile(profile_row), "source": source}


# ─── PUT /api/risk-rules/rules ────────────────────────────────────────────────

@router.put("/risk-rules/rules")
async def put_risk_rules(
    payload: RiskRulesPayload,
    portfolioName: str = Query(default="Main Portfolio"),
    authorization: str | None = Header(default=None),
):
    user_id = await _require_user_id(authorization)
    portfolio = await _require_portfolio(user_id, portfolioName)
    portfolio_id = str(portfolio["id"])
    now_iso = datetime.now(timezone.utc).isoformat()

    # Look for existing portfolio-specific profile
    existing_rows = await select_rows(
        "risk_profiles",
        params=[
            build_filter_select(PROFILE_SELECT),
            build_filter_eq("user_id", user_id),
            build_filter_eq("portfolio_id", portfolio_id),
            build_filter_eq("is_active", "true"),
            build_filter_order("updated_at", ascending=False),
            build_filter_limit(1),
        ],
    )
    existing = existing_rows[0] if isinstance(existing_rows, list) and existing_rows else None

    upsert_data: dict[str, Any] = {
        "max_drawdown_pct": payload.maxDrawdownPct,
        "max_position_size_pct": payload.maxPositionSizePct,
        "max_daily_loss_usd": payload.maxDailyLossUsd,
        "is_active": True,
        "updated_at": now_iso,
    }

    if existing:
        updated = await update_rows(
            "risk_profiles",
            params=[
                build_filter_eq("id", str(existing["id"])),
                build_filter_eq("user_id", user_id),
            ],
            updates=upsert_data,
            single=True,
        )
        profile_row = updated if isinstance(updated, dict) else existing
    else:
        profile_row = await insert_row("risk_profiles", {
            "user_id": user_id,
            "portfolio_id": portfolio_id,
            "name": "Spot Risk Rules",
            "max_drawdown_pct": payload.maxDrawdownPct,
            "max_position_size_pct": payload.maxPositionSizePct,
            "max_daily_loss_usd": payload.maxDailyLossUsd,
            "max_leverage": None,
            "risk_per_trade_pct": None,
            "is_active": True,
        }) or {}

    return {"profile": _row_to_profile(profile_row), "source": "portfolio"}


# ─── GET /api/risk-rules/alerts ──────────────────────────────────────────────

@router.get("/risk-rules/alerts")
async def get_risk_alerts(
    portfolioName: str = Query(default="Main Portfolio"),
    status: str = Query(default="active"),
    limit: int = Query(default=40, ge=1, le=100),
    authorization: str | None = Header(default=None),
):
    user_id = await _require_user_id(authorization)
    portfolio = await _require_portfolio(user_id, portfolioName)
    portfolio_id = str(portfolio["id"])

    valid_statuses = {"active", "acknowledged", "resolved", "all"}
    if status not in valid_statuses:
        status = "active"

    params = [
        build_filter_select(ALERT_SELECT),
        build_filter_eq("user_id", user_id),
        build_filter_eq("portfolio_id", portfolio_id),
        build_filter_order("last_triggered_at", ascending=False),
        build_filter_limit(min(limit, 100)),
    ]
    if status != "all":
        params.append(build_filter_eq("status", status))

    rows = await select_rows("risk_alerts", params=params)
    alerts = [_row_to_alert(r) for r in (rows or []) if isinstance(r, dict)]
    return {"alerts": alerts}


# ─── PATCH /api/risk-rules/alerts/{alert_id} ─────────────────────────────────

@router.patch("/risk-rules/alerts/{alert_id}")
async def patch_risk_alert(
    alert_id: str,
    payload: AlertStatusUpdate,
    authorization: str | None = Header(default=None),
):
    user_id = await _require_user_id(authorization)
    now_iso = datetime.now(timezone.utc).isoformat()

    updates: dict[str, Any] = {"status": payload.status}
    if payload.status == "acknowledged":
        updates["acknowledged_at"] = now_iso
        updates["resolved_at"] = None
    elif payload.status == "resolved":
        updates["resolved_at"] = now_iso

    updated = await update_rows(
        "risk_alerts",
        params=[
            build_filter_eq("id", alert_id),
            build_filter_eq("user_id", user_id),
        ],
        updates=updates,
        single=True,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Alert not found.")

    return {"alert": _row_to_alert(updated)}


# ─── GET /api/risk-rules/score ────────────────────────────────────────────────

@router.get("/risk-rules/score")
async def get_risk_score(
    portfolioName: str = Query(default="Main Portfolio"),
    limit: int = Query(default=20, ge=1, le=50),
    authorization: str | None = Header(default=None),
):
    user_id = await _require_user_id(authorization)
    portfolio = await _require_portfolio(user_id, portfolioName)
    portfolio_id = str(portfolio["id"])

    rows = await select_rows(
        "risk_events",
        params=[
            build_filter_select(EVENT_SELECT),
            build_filter_eq("user_id", user_id),
            build_filter_eq("portfolio_id", portfolio_id),
            build_filter_order("occurred_at", ascending=False),
            build_filter_limit(min(limit, 50)),
        ],
    )
    events = [_row_to_event(r) for r in (rows or []) if isinstance(r, dict)]

    # Weighted aggregate risk score from stored events
    critical_count = sum(1 for e in events if e["severity"] == "critical")
    warning_count = sum(1 for e in events if e["severity"] == "warning")
    risk_score = min(100, critical_count * 25 + warning_count * 10)

    return {"events": events, "riskScore": risk_score}


# ─── POST /api/risk-rules/evaluate ───────────────────────────────────────────

@router.post("/risk-rules/evaluate")
async def evaluate_risk(
    payload: EvaluatePayload,
    authorization: str | None = Header(default=None),
):
    """Evaluate a portfolio snapshot against saved risk rules and store alerts."""
    user_id = await _require_user_id(authorization)
    portfolio = await _require_portfolio(user_id, payload.portfolioName)
    portfolio_id = str(portfolio["id"])

    profile_row = await _get_active_profile(user_id, portfolio_id)
    if not profile_row:
        return {"violations": [], "alertsCreated": 0}

    profile_id = str(profile_row.get("id", ""))
    now_iso = datetime.now(timezone.utc).isoformat()
    hour_prefix = now_iso[:13]  # dedup key: same violation within same hour

    violations: list[dict[str, Any]] = []
    snapshot = payload.snapshot
    metrics = snapshot.metrics
    assets = snapshot.assets
    chart = snapshot.chart

    # ── Drawdown check ───────────────────────────────────────────────────────
    max_drawdown_pct = profile_row.get("max_drawdown_pct")
    if max_drawdown_pct is not None:
        observed = float(metrics.maxDrawdownPercent or 0.0)
        threshold = float(max_drawdown_pct)
        if observed > threshold:
            sig = f"drawdown:{threshold:.2f}"
            violations.append({
                "event_type": "drawdown_limit_breached",
                "severity": _select_severity(observed, threshold),
                "title": "Drawdown threshold breached",
                "message": f"Drawdown reached {observed:.2f}% (limit {threshold:.2f}%).",
                "observed_value": observed,
                "threshold_value": threshold,
                "symbol": None,
                "signature": sig,
                "dedup_key": f"{sig}:{hour_prefix}",
            })

    # ── Position concentration check ─────────────────────────────────────────
    max_position_pct = profile_row.get("max_position_size_pct")
    if max_position_pct is not None:
        threshold = float(max_position_pct)
        oversized = sorted(
            [a for a in assets if a.allocationPercent > threshold],
            key=lambda a: a.allocationPercent,
            reverse=True,
        )[:3]
        for asset in oversized:
            alloc = float(asset.allocationPercent)
            symbol = asset.symbol
            sig = f"position:{symbol}:{threshold:.2f}"
            violations.append({
                "event_type": "position_size_limit_breached",
                "severity": _select_severity(alloc, threshold),
                "title": "Position concentration too high",
                "message": (
                    f"{symbol.replace('USDT', '')} allocation is {alloc:.2f}%"
                    f" (limit {threshold:.2f}%)."
                ),
                "observed_value": alloc,
                "threshold_value": threshold,
                "symbol": symbol,
                "signature": sig,
                "dedup_key": f"{sig}:{hour_prefix}",
            })

    # ── Daily loss check ─────────────────────────────────────────────────────
    max_daily_loss_usd = profile_row.get("max_daily_loss_usd")
    if max_daily_loss_usd is not None and len(chart) >= 2:
        previous = float(chart[-2].totalValueUsd or 0.0)
        current = float(chart[-1].totalValueUsd or 0.0)
        daily_loss = max(0.0, previous - current)
        threshold = float(max_daily_loss_usd)
        if daily_loss > threshold:
            sig = f"daily-loss:{threshold:.2f}"
            violations.append({
                "event_type": "daily_loss_limit_breached",
                "severity": _select_severity(daily_loss, threshold),
                "title": "Daily loss threshold breached",
                "message": f"Daily loss is {daily_loss:.2f} USD (limit {threshold:.2f} USD).",
                "observed_value": daily_loss,
                "threshold_value": threshold,
                "symbol": None,
                "signature": sig,
                "dedup_key": f"{sig}:{hour_prefix}",
            })

    next_signatures = {v["signature"] for v in violations}

    if not violations:
        await _resolve_stale_alerts(user_id, portfolio_id, now_iso, set())
        return {"violations": [], "alertsCreated": 0}

    # Load existing active alerts for dedup
    active_rows = await select_rows(
        "risk_alerts",
        params=[
            build_filter_select(ALERT_SELECT),
            build_filter_eq("user_id", user_id),
            build_filter_eq("portfolio_id", portfolio_id),
            build_filter_eq("status", "active"),
            build_filter_limit(100),
        ],
    )
    active_by_sig: dict[str, dict[str, Any]] = {
        r["signature"]: r
        for r in (active_rows or [])
        if isinstance(r, dict) and r.get("signature")
    }

    alerts_created = 0
    for violation in violations:
        sig = violation["signature"]
        existing = active_by_sig.get(sig)

        if existing:
            next_trigger_count = max(1, int(existing.get("trigger_count") or 1)) + 1
        else:
            next_trigger_count = 1

        severity = violation["severity"]
        if severity != "critical" and next_trigger_count >= 3:
            severity = "critical"

        message = violation["message"]
        if next_trigger_count >= 3:
            message = (
                f"{message} This breach has repeated {next_trigger_count} times while still active."
            )

        logged = await _log_event_if_changed(
            user_id=user_id,
            portfolio_id=portfolio_id,
            risk_profile_id=profile_id,
            event_type=violation["event_type"],
            severity=severity,
            details={
                "title": violation["title"],
                "message": message,
                "observedValue": violation["observed_value"],
                "thresholdValue": violation["threshold_value"],
                "symbol": violation.get("symbol"),
                "signature": violation["dedup_key"],
                "alertSignature": sig,
                "triggerCount": next_trigger_count,
            },
        )

        if logged:
            alerts_created += 1

        if not existing:
            await insert_row("risk_alerts", {
                "user_id": user_id,
                "portfolio_id": portfolio_id,
                "risk_profile_id": profile_id,
                "event_type": violation["event_type"],
                "severity": severity,
                "status": "active",
                "title": violation["title"],
                "message": message,
                "observed_value": violation["observed_value"],
                "threshold_value": violation["threshold_value"],
                "symbol": violation.get("symbol"),
                "signature": sig,
                "trigger_count": 1,
                "first_triggered_at": now_iso,
                "last_triggered_at": now_iso,
                "acknowledged_at": None,
                "resolved_at": None,
            })
        elif logged:
            await update_rows(
                "risk_alerts",
                params=[
                    build_filter_eq("id", str(existing["id"])),
                    build_filter_eq("user_id", user_id),
                ],
                updates={
                    "risk_profile_id": profile_id,
                    "severity": severity,
                    "title": violation["title"],
                    "message": message,
                    "observed_value": violation["observed_value"],
                    "threshold_value": violation["threshold_value"],
                    "symbol": violation.get("symbol"),
                    "last_triggered_at": now_iso,
                    "trigger_count": next_trigger_count,
                },
            )

    await _resolve_stale_alerts(user_id, portfolio_id, now_iso, next_signatures)

    clean_violations = [
        {k: v for k, v in v.items() if k != "dedup_key"} for v in violations
    ]
    return {"violations": clean_violations, "alertsCreated": alerts_created}
