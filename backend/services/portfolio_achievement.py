from __future__ import annotations

import logging
from datetime import datetime, timezone

from core.config import settings
from schemas.achievement import AchievementDefinition, PortfolioAchievementUnlock, PortfolioAchievementsResponse
from services.portfolio_achievement_evaluator import PortfolioAchievementEvaluator, snapshot_time
from services.portfolio_achievement_store import (
    has_portfolio_achievement_unlock,
    insert_portfolio_achievement_unlock,
    list_active_achievements,
    list_portfolio_achievement_unlocks,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# tokenURI mapping — JSON metadata on IPFS (OpenSea-compatible)
# Images: ipfs://_IMAGE_FOLDER_CID/<key>.png
# Metadata: ipfs://_JSON_FOLDER_CID/<key>.json
# ---------------------------------------------------------------------------
_IMAGE_FOLDER_CID = "bafybeih64xr5ymvnjb6c2pbvohldvit22d2snufeojizeexbch4gutxsii"
_JSON_FOLDER_CID  = "bafybeifctpcjbfp5qj2aqav67mvsywycifqvkgapgj2czpjhs2lkpjxxgi"

_ACHIEVEMENT_TOKEN_URI: dict[str, str] = {
    "diversified_5_assets":  f"ipfs://{_JSON_FOLDER_CID}/diversified_5_assets.json",
    "diversified_10_assets": f"ipfs://{_JSON_FOLDER_CID}/diversified_10_assets.json",
    "diversified_20_assets": f"ipfs://{_JSON_FOLDER_CID}/diversified_20_assets.json",
    "rich_10k":              f"ipfs://{_JSON_FOLDER_CID}/rich_10k.json",
    "rich_50k":              f"ipfs://{_JSON_FOLDER_CID}/rich_50k.json",
    "rich_100k":             f"ipfs://{_JSON_FOLDER_CID}/rich_100k.json",
    "drawdown_guard_10":     f"ipfs://{_JSON_FOLDER_CID}/drawdown_guard_10.json",
    "drawdown_guard_5":      f"ipfs://{_JSON_FOLDER_CID}/drawdown_guard_5.json",
    "sharpe_1_0":            f"ipfs://{_JSON_FOLDER_CID}/sharpe_1_0.json",
    "sharpe_2_0":            f"ipfs://{_JSON_FOLDER_CID}/sharpe_2_0.json",
}

def _token_uri_for(achievement_key: str) -> str:
    return _ACHIEVEMENT_TOKEN_URI.get(
        achievement_key,
        f"ipfs://placeholder/{achievement_key}",
    )


async def _mint_achievement_nft(*, user_id: str, certificate_id: str, achievement_key: str) -> None:
    """
    Mint a Soulbound NFT badge for an achievement.
    Non-blocking — logs warning on failure, never raises.
    """
    try:
        from eth_account import Account  # type: ignore

        from services.nft_mint_service import NftMintError, NftMintService
        from services.portfolio_snapshot_certificate_store import (
            mark_portfolio_snapshot_certificate_minted,
            mark_portfolio_snapshot_certificate_mint_failed,
        )

        platform_wallet = Account.from_key(settings.eth_sepolia_private_key.strip()).address
        token_uri = _token_uri_for(achievement_key)

        mint_svc = NftMintService()
        result = await mint_svc.mint(to_address=platform_wallet, token_uri=token_uri)

        await mark_portfolio_snapshot_certificate_minted(
            certificate_id,
            user_id,
            token_id=result.token_id,
            contract_address=result.contract_address,
            tx_hash=result.tx_hash,
        )
        logger.info(
            "NFT minted for achievement=%s cert=%s token_id=%s tx=%s",
            achievement_key, certificate_id, result.token_id, result.tx_hash,
        )
    except Exception as exc:
        logger.warning(
            "NFT mint failed (non-fatal) for achievement=%s cert=%s: %s",
            achievement_key, certificate_id, exc,
        )
        try:
            from services.portfolio_snapshot_certificate_store import (
                mark_portfolio_snapshot_certificate_mint_failed,
            )
            await mark_portfolio_snapshot_certificate_mint_failed(
                certificate_id, user_id, error=str(exc)
            )
        except Exception:
            pass


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

            # Mint Soulbound NFT badge — failure is non-blocking
            await _mint_achievement_nft(user_id=user_id, certificate_id=cert.id, achievement_key=definition.key)

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
