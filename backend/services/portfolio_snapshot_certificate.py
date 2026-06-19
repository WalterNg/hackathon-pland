from __future__ import annotations

from datetime import datetime, timezone
import logging

from core.config import settings
from schemas.portfolio_snapshot_certificate import (
    PortfolioSnapshotCertificateDetail,
    PortfolioSnapshotCertificateListItem,
    PortfolioSnapshotCertificateRecord,
    PortfolioSnapshotCertificateVerifyResponse,
)
from services.portfolio_snapshot_canonicalizer import canonicalize_portfolio_snapshot
from services.portfolio_snapshot_certificate_store import (
    get_latest_portfolio_snapshot,
    get_portfolio_snapshot_certificate,
    insert_portfolio_snapshot_certificate,
    list_portfolio_snapshot_certificates,
    mark_portfolio_snapshot_certificate_verified,
    resolve_portfolio,
)
from services.portfolio_snapshot_hasher import hash_portfolio_snapshot

logger = logging.getLogger("hackathon-pland")


def _build_token_uri(cert_id: str) -> str:
    base = (settings.app_base_url or "https://pland.vercel.app").rstrip("/")
    return f"{base}/api/nft/certificate/{cert_id}"


async def mint_certificate_nft(*, user_id: str, certificate_id: str) -> None:
    """
    Mint a Soulbound NFT for any certificate (manual or achievement).
    Non-blocking — logs warning on failure, never raises.
    """
    try:
        from eth_account import Account  # type: ignore
        from services.nft_mint_service import NftMintService
        from services.portfolio_snapshot_certificate_store import (
            mark_portfolio_snapshot_certificate_minted,
            mark_portfolio_snapshot_certificate_mint_failed,
        )

        platform_wallet = Account.from_key(settings.eth_sepolia_private_key.strip()).address
        token_uri = _build_token_uri(certificate_id)

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
            "NFT minted for cert=%s token_id=%s tx=%s",
            certificate_id, result.token_id, result.tx_hash,
        )
    except Exception as exc:
        logger.warning("NFT mint failed (non-fatal) for cert=%s: %s", certificate_id, exc)
        try:
            from services.portfolio_snapshot_certificate_store import mark_portfolio_snapshot_certificate_mint_failed
            await mark_portfolio_snapshot_certificate_mint_failed(certificate_id, user_id, error=str(exc))
        except Exception:
            pass


class PortfolioSnapshotCertificateService:

    def _to_list_item(self, record: PortfolioSnapshotCertificateRecord) -> PortfolioSnapshotCertificateListItem:
        return PortfolioSnapshotCertificateListItem(
            id=record.id,
            portfolioId=record.portfolio_id,
            portfolioSnapshotId=record.portfolio_snapshot_id,
            certificateVersion=record.certificate_version,
            snapshotAt=record.snapshot_at,
            snapshotHash=record.snapshot_hash,
            hashAlgorithm=record.hash_algorithm,
            certifyMode=record.certify_mode,
            achievementKey=record.achievement_key,
            title=record.title,
            note=record.note,
            verificationStatus=record.verification_status,
            verifiedAt=record.verified_at,
            createdAt=record.created_at,
        )

    def _to_detail(self, record: PortfolioSnapshotCertificateRecord) -> PortfolioSnapshotCertificateDetail:
        return PortfolioSnapshotCertificateDetail(
            **self._to_list_item(record).model_dump(by_alias=True),
            snapshotPayload=record.snapshot_payload,
            canonicalizationVersion=record.canonicalization_version,
        )

    async def resolve_portfolio_for_user(
        self,
        user_id: str,
        *,
        portfolio_id: str | None = None,
        portfolio_name: str | None = None,
    ) -> dict | None:
        return await resolve_portfolio(user_id, portfolio_id=portfolio_id, portfolio_name=portfolio_name)

    async def issue_certificate(
        self,
        user_id: str,
        portfolio_id: str,
        snapshot_payload: dict | None,
        *,
        certify_mode: str = "manual",
        title: str | None = None,
        note: str | None = None,
        achievement_key: str | None = None,
        portfolio_snapshot_id: str | None = None,
    ) -> PortfolioSnapshotCertificateDetail:
        latest_snapshot_row = None
        payload = snapshot_payload
        snapshot_at = None

        if payload is None:
            latest_snapshot_row = await get_latest_portfolio_snapshot(portfolio_id, user_id)
            if not latest_snapshot_row:
                raise ValueError("No portfolio snapshot is available for this portfolio.")
            payload = latest_snapshot_row.get("metadata")
            portfolio_snapshot_id = str(latest_snapshot_row.get("id") or "")
            snapshot_at = latest_snapshot_row.get("snapshot_at")

        if not isinstance(payload, dict):
            raise ValueError("Snapshot payload is missing or invalid.")

        canonical_payload = canonicalize_portfolio_snapshot(payload)
        snapshot_hash = hash_portfolio_snapshot(canonical_payload)

        safe_title = (title or "Certified Snapshot").strip() or "Certified Snapshot"
        safe_note = note.strip() if isinstance(note, str) and note.strip() else None

        snapshot_timestamp = snapshot_at or canonical_payload.summary.get("timestamp")
        if not snapshot_timestamp:
            snapshot_timestamp = datetime.now(timezone.utc).isoformat()

        inserted_record = await insert_portfolio_snapshot_certificate(
            {
                "user_id": user_id,
                "portfolio_id": portfolio_id,
                "portfolio_snapshot_id": portfolio_snapshot_id or None,
                "certificate_version": "v1",
                "snapshot_at": snapshot_timestamp,
                "snapshot_payload": canonical_payload.model_dump(by_alias=True),
                "snapshot_hash": snapshot_hash,
                "hash_algorithm": "sha256",
                "canonicalization_version": "portfolio-snapshot-v1",
                "certify_mode": certify_mode,
                "achievement_key": achievement_key,
                "title": safe_title,
                "note": safe_note,
                "verification_status": "unverified",
            }
        )

        detail = self._to_detail(inserted_record)

        # Mint NFT badge for manual certificates (non-blocking)
        if certify_mode == "manual":
            await mint_certificate_nft(user_id=user_id, certificate_id=inserted_record.id)

        return detail

    async def list_certificates(self, user_id: str, portfolio_id: str) -> list[PortfolioSnapshotCertificateListItem]:
        records = await list_portfolio_snapshot_certificates(user_id, portfolio_id)
        return [self._to_list_item(record) for record in records]

    async def get_certificate(self, user_id: str, certificate_id: str) -> PortfolioSnapshotCertificateDetail | None:
        record = await get_portfolio_snapshot_certificate(certificate_id, user_id)
        if record is None:
            return None
        return self._to_detail(record)

    async def verify_certificate(self, user_id: str, certificate_id: str) -> PortfolioSnapshotCertificateVerifyResponse:
        record = await get_portfolio_snapshot_certificate(certificate_id, user_id)
        if record is None:
            raise ValueError("Certificate not found.")

        canonical_payload = canonicalize_portfolio_snapshot(record.snapshot_payload)
        computed_hash = hash_portfolio_snapshot(canonical_payload)
        is_valid = computed_hash == record.snapshot_hash
        verification_status = "verified" if is_valid else "mismatch"

        updated_record = await mark_portfolio_snapshot_certificate_verified(
            certificate_id,
            user_id,
            verification_status=verification_status,
        )
        verified_at = updated_record.verified_at if updated_record and updated_record.verified_at else datetime.now(timezone.utc)

        return PortfolioSnapshotCertificateVerifyResponse(
            certificateId=record.id,
            isValid=is_valid,
            verificationStatus=verification_status,
            computedHash=computed_hash,
            storedHash=record.snapshot_hash,
            verifiedAt=verified_at,
        )

