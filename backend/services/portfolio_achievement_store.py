from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from schemas.achievement import AchievementDefinition, PortfolioAchievementUnlock
from services.supabase_rest import (
    build_filter_eq,
    build_filter_order,
    build_filter_select,
    insert_row,
    select_rows,
)


ACHIEVEMENT_SELECT_COLUMNS = "key,title,nickname,description,category,metric,operator,threshold,tier,is_active"

UNLOCK_SELECT_COLUMNS = (
    "id,user_id,portfolio_id,achievement_key,certificate_id,unlocked_at,snapshot_at,snapshot_hash,metadata,"
    f"achievement:achievements({ACHIEVEMENT_SELECT_COLUMNS})"
)


async def list_active_achievements() -> list[AchievementDefinition]:
    rows = await select_rows(
        "achievements",
        params=[
            build_filter_select(ACHIEVEMENT_SELECT_COLUMNS),
            build_filter_eq("is_active", "true"),
            build_filter_order("tier", ascending=True),
            build_filter_order("key", ascending=True),
        ],
    )
    return [
        AchievementDefinition(
            key=str(row.get("key", "")),
            title=str(row.get("title", "")),
            nickname=str(row.get("nickname", "")),
            description=str(row.get("description", "")),
            category=str(row.get("category", "")),
            metric=str(row.get("metric", "")),
            operator=str(row.get("operator", "")),
            threshold=float(row.get("threshold", 0) or 0),
            tier=int(row.get("tier", 1) or 1),
            isActive=bool(row.get("is_active", True)),
        )
        for row in rows
        if isinstance(row, dict)
    ]


async def insert_portfolio_achievement_unlock(
    *,
    user_id: str,
    portfolio_id: str,
    achievement_key: str,
    certificate_id: str | None,
    snapshot_at: datetime,
    snapshot_hash: str,
    metadata: dict[str, Any] | None = None,
) -> PortfolioAchievementUnlock | None:
    payload = await insert_row(
        "portfolio_achievement_unlocks",
        {
            "user_id": user_id,
            "portfolio_id": portfolio_id,
            "achievement_key": achievement_key,
            "certificate_id": certificate_id,
            "unlocked_at": datetime.now(timezone.utc).isoformat(),
            "snapshot_at": snapshot_at.isoformat(),
            "snapshot_hash": snapshot_hash,
            "metadata": metadata or {},
        },
    )
    if not isinstance(payload, dict):
        return None
    return await get_portfolio_achievement_unlock(str(payload.get("id", "")), user_id)


async def get_portfolio_achievement_unlock(unlock_id: str, user_id: str) -> PortfolioAchievementUnlock | None:
    row = await select_rows(
        "portfolio_achievement_unlocks",
        params=[
            build_filter_select(UNLOCK_SELECT_COLUMNS),
            build_filter_eq("id", unlock_id),
            build_filter_eq("user_id", user_id),
        ],
        single=True,
    )
    if not isinstance(row, dict):
        return None
    return _map_unlock_row(row)


async def list_portfolio_achievement_unlocks(user_id: str, portfolio_id: str) -> list[PortfolioAchievementUnlock]:
    rows = await select_rows(
        "portfolio_achievement_unlocks",
        params=[
            build_filter_select(UNLOCK_SELECT_COLUMNS),
            build_filter_eq("user_id", user_id),
            build_filter_eq("portfolio_id", portfolio_id),
            build_filter_order("unlocked_at", ascending=False),
        ],
    )
    mapped: list[PortfolioAchievementUnlock] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        unlock = _map_unlock_row(row)
        if unlock is not None:
            mapped.append(unlock)
    return mapped


async def has_portfolio_achievement_unlock(user_id: str, portfolio_id: str, achievement_key: str) -> bool:
    row = await select_rows(
        "portfolio_achievement_unlocks",
        params=[
            build_filter_select("id"),
            build_filter_eq("user_id", user_id),
            build_filter_eq("portfolio_id", portfolio_id),
            build_filter_eq("achievement_key", achievement_key),
        ],
        single=True,
    )
    return isinstance(row, dict) and bool(row.get("id"))


def _map_unlock_row(row: dict[str, Any]) -> PortfolioAchievementUnlock | None:
    achievement_row = row.get("achievement")
    if not isinstance(achievement_row, dict):
        return None

    achievement = AchievementDefinition(
        key=str(achievement_row.get("key", "")),
        title=str(achievement_row.get("title", "")),
        nickname=str(achievement_row.get("nickname", "")),
        description=str(achievement_row.get("description", "")),
        category=str(achievement_row.get("category", "")),
        metric=str(achievement_row.get("metric", "")),
        operator=str(achievement_row.get("operator", "")),
        threshold=float(achievement_row.get("threshold", 0) or 0),
        tier=int(achievement_row.get("tier", 1) or 1),
        isActive=bool(achievement_row.get("is_active", True)),
    )

    try:
        return PortfolioAchievementUnlock(
            id=str(row.get("id", "")),
            userId=str(row.get("user_id", "")),
            portfolioId=str(row.get("portfolio_id", "")),
            achievementKey=str(row.get("achievement_key", "")),
            certificateId=(str(row.get("certificate_id")) if row.get("certificate_id") else None),
            unlockedAt=row.get("unlocked_at"),
            snapshotAt=row.get("snapshot_at"),
            snapshotHash=str(row.get("snapshot_hash", "")),
            metadata=row.get("metadata") if isinstance(row.get("metadata"), dict) else {},
            achievement=achievement,
        )
    except Exception:
        return None
