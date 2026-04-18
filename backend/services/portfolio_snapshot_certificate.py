from __future__ import annotations

from datetime import datetime, timezone
import logging

from schemas.portfolio_snapshot_certificate import (
    PortfolioSnapshotCertificateDetail,
    PortfolioSnapshotCertificateListItem,
    PortfolioSnapshotCertificateRecord,
    PortfolioSnapshotCertificateVerifyResponse,
)
from services.blockchain_anchor import EthereumSepoliaHashAnchorService
from services.portfolio_snapshot_canonicalizer import canonicalize_portfolio_snapshot
from services.portfolio_snapshot_certificate_store import (
    get_latest_portfolio_snapshot,
    get_portfolio_snapshot_certificate,
    insert_portfolio_snapshot_certificate,
    list_portfolio_snapshot_certificates,
    mark_portfolio_snapshot_certificate_anchored,
    mark_portfolio_snapshot_certificate_failed,
    mark_portfolio_snapshot_certificate_verified,
    resolve_portfolio,
)
from services.portfolio_snapshot_hasher import hash_portfolio_snapshot

logger = logging.getLogger("hackathon-pland")


class PortfolioSnapshotCertificateService:
    def __init__(self, anchor_service: EthereumSepoliaHashAnchorService | None = None) -> None:
        self.anchor_service = anchor_service or EthereumSepoliaHashAnchorService()

    def _to_list_item(self, record: PortfolioSnapshotCertificateRecord) -> PortfolioSnapshotCertificateListItem:
        return PortfolioSnapshotCertificateListItem(
            id=record.id,
            portfolioId=record.portfolio_id,
            portfolioSnapshotId=record.portfolio_snapshot_id,
            certificateVersion=record.certificate_version,
            snapshotAt=record.snapshot_at,
            snapshotHash=record.snapshot_hash,
            hashAlgorithm=record.hash_algorithm,
            anchorChain=record.anchor_chain,
            anchorNetwork=record.anchor_network,
            anchorTxHash=record.anchor_tx_hash,
            anchorBlockNumber=record.anchor_block_number,
            anchorExplorerUrl=record.anchor_explorer_url,
            anchorStatus=record.anchor_status,
            anchorError=record.anchor_error,
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
            anchorBlockHash=record.anchor_block_hash,
            anchorWalletAddress=record.anchor_wallet_address,
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
                "anchor_chain": "ethereum",
                "anchor_network": "sepolia",
                "anchor_status": "pending_anchor",
                "certify_mode": certify_mode,
                "achievement_key": achievement_key,
                "title": safe_title,
                "note": safe_note,
                "verification_status": "unverified",
            }
        )

        try:
            anchor_result = await self.anchor_service.anchor_snapshot_hash(snapshot_hash)
            anchored_record = await mark_portfolio_snapshot_certificate_anchored(
                inserted_record.id,
                user_id,
                tx_hash=anchor_result.tx_hash,
                block_number=anchor_result.block_number,
                block_hash=anchor_result.block_hash,
                wallet_address=anchor_result.wallet_address,
                explorer_url=anchor_result.explorer_url,
            )
            if anchored_record is None:
                raise ValueError("Certificate was anchored but could not be updated in storage.")
            return self._to_detail(anchored_record)
        except Exception as exc:
            failed_record = await mark_portfolio_snapshot_certificate_failed(
                inserted_record.id,
                user_id,
                anchor_error=str(exc),
            )
            return self._to_detail(failed_record or inserted_record)

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
            anchoredHash=record.snapshot_hash,
            anchorTxHash=record.anchor_tx_hash,
            anchorExplorerUrl=record.anchor_explorer_url,
            verifiedAt=verified_at,
        )

