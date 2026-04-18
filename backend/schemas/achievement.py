from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


AchievementMetric = Literal[
    "distinct_assets",
    "total_value_usd",
    "max_drawdown_percent",
    "sharpe_ratio_30d",
]
AchievementOperator = Literal["gte", "lte"]


class AchievementDefinition(BaseModel):
    key: str
    title: str
    nickname: str
    description: str
    category: str
    metric: AchievementMetric
    operator: AchievementOperator
    threshold: float
    tier: int
    is_active: bool = Field(alias="isActive")


class PortfolioAchievementUnlock(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    portfolio_id: str = Field(alias="portfolioId")
    achievement_key: str = Field(alias="achievementKey")
    certificate_id: str | None = Field(default=None, alias="certificateId")
    unlocked_at: datetime = Field(alias="unlockedAt")
    snapshot_at: datetime = Field(alias="snapshotAt")
    snapshot_hash: str = Field(alias="snapshotHash")
    metadata: dict[str, Any]
    achievement: AchievementDefinition


class PortfolioAchievementsResponse(BaseModel):
    portfolio_id: str = Field(alias="portfolioId")
    unlocks: list[PortfolioAchievementUnlock]


class PortfolioAchievementAutoCertifyRequest(BaseModel):
    portfolio_id: str | None = Field(default=None, alias="portfolioId")
    portfolio_name: str | None = Field(default=None, alias="portfolioName")
    snapshot_payload: dict[str, Any] | None = Field(default=None, alias="snapshotPayload")
