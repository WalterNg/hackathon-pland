from __future__ import annotations

import logging
from datetime import datetime, timezone

from schemas.achievement import AchievementDefinition, PortfolioAchievementUnlock, PortfolioAchievementsResponse
from services.portfolio_achievement_evaluator import PortfolioAchievementEvaluator, snapshot_time
from services.portfolio_achievement_store import (
    has_portfolio_achievement_unlock,
    insert_portfolio_achievement_unlock,
    list_active_achievements,
    list_portfolio_achievement_unlocks,
)

logger = logging.getLogger(__name__)


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

        # Local imports avoid service-layer import cycles.
        from services.portfolio_snapshot_certificate import PortfolioSnapshotCertificateService, mint_certificate_nft

        certificate_service = PortfolioSnapshotCertificateService()

        for definition, metric_value in matched:
            if await has_portfolio_achievement_unlock(user_id, portfolio_id, definition.key):
                continue

            try:
                cert = await certificate_service.issue_certificate(
                    user_id=user_id,
                    portfolio_id=portfolio_id,
                    snapshot_payload=snapshot_payload,
                    certify_mode="auto_achievement",
                    title=definition.title,
                    note=definition.description,
                    achievement_key=definition.key,
                )
            except Exception as exc:
                logger.warning(
                    "Failed to create cert for achievement=%s, skipping: %s",
                    definition.key, exc,
                )
                continue

            # Mint Soulbound NFT badge — failure is non-blocking
            await mint_certificate_nft(user_id=user_id, certificate_id=cert.id)

            try:
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
            except Exception as exc:
                # Race condition: another concurrent request already inserted the unlock.
                logger.info(
                    "Unlock insert skipped for achievement=%s (concurrent request won): %s",
                    definition.key, exc,
                )
                unlock = None

            if unlock is not None:
                created_unlocks.append(unlock)

        return created_unlocks
