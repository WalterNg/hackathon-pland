from __future__ import annotations

from datetime import datetime, timezone

from schemas.achievement import AchievementDefinition, PortfolioAchievementUnlock, PortfolioAchievementsResponse
from services.portfolio_achievement_evaluator import PortfolioAchievementEvaluator, snapshot_time
from services.portfolio_achievement_store import (
    has_portfolio_achievement_unlock,
    insert_portfolio_achievement_unlock,
    list_active_achievements,
    list_portfolio_achievement_unlocks,
)


class PortfolioAchievementService:
    def __init__(self) -> None:
        self._evaluator = PortfolioAchievementEvaluator()

    async def list_achievement_catalog(self) -> list[AchievementDefinition]:
        return await list_active_achievements()

    async def list_unlocked_achievements(self, user_id: str, portfolio_id: str) -> PortfolioAchievementsResponse:
        unlocks = await list_portfolio_achievement_unlocks(user_id, portfolio_id)
        return PortfolioAchievementsResponse(portfolioId=portfolio_id, unlocks=unlocks)

    async def auto_certify_achievements(
        self,
        *,
        user_id: str,
        portfolio_id: str,
        snapshot_payload: dict,
    ) -> list[PortfolioAchievementUnlock]:
        definitions = await list_active_achievements()
        if not definitions:
            return []

        matched = self._evaluator.evaluate(definitions, snapshot_payload)
        if not matched:
            return []

        now = datetime.now(timezone.utc)
        ts = snapshot_time(snapshot_payload, now)

        created_unlocks: list[PortfolioAchievementUnlock] = []

        # Local import avoids service-layer import cycles.
        from services.portfolio_snapshot_certificate import PortfolioSnapshotCertificateService

        certificate_service = PortfolioSnapshotCertificateService()

        for definition, metric_value in matched:
            if await has_portfolio_achievement_unlock(user_id, portfolio_id, definition.key):
                continue

            cert = await certificate_service.issue_certificate(
                user_id=user_id,
                portfolio_id=portfolio_id,
                snapshot_payload=snapshot_payload,
                certify_mode="auto_achievement",
                title=definition.title,
                note=definition.description,
                achievement_key=definition.key,
            )

            unlock = await insert_portfolio_achievement_unlock(
                user_id=user_id,
                portfolio_id=portfolio_id,
                achievement_key=definition.key,
                certificate_id=cert.id,
                snapshot_at=ts,
                snapshot_hash=cert.snapshot_hash,
                metadata={
                    "metric": definition.metric,
                    "operator": definition.operator,
                    "threshold": float(definition.threshold),
                    "observedValue": metric_value,
                },
            )
            if unlock is not None:
                created_unlocks.append(unlock)

        return created_unlocks
