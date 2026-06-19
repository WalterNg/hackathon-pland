from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from schemas.portfolio_snapshot_certificate import PortfolioSnapshotCertificateRecord
from services.supabase_rest import (
    build_filter_eq,
    build_filter_is_null,
    build_filter_limit,
    build_filter_order,
    build_filter_select,
    insert_row,
    select_rows,
    update_rows,
)


CERTIFICATE_SELECT_COLUMNS = (
    "id,user_id,portfolio_id,portfolio_snapshot_id,certificate_version,snapshot_at,"
    "snapshot_payload,snapshot_hash,hash_algorithm,canonicalization_version,"
    "certify_mode,achievement_key,title,note,"
    "verification_status,verified_at,created_at,"
    "nft_mint_status,nft_token_id,nft_contract_address,nft_tx_hash"
)


def _record_from_row(row: dict[str, Any] | None) -> PortfolioSnapshotCertificateRecord | None:
    if not row:
        return None
    return PortfolioSnapshotCertificateRecord(**row)


async def insert_portfolio_snapshot_certificate(row: dict[str, Any]) -> PortfolioSnapshotCertificateRecord:
    payload = await insert_row("portfolio_snapshot_certificates", row)
    record = _record_from_row(payload)
    if record is None:
        raise ValueError("Supabase did not return the inserted certificate.")
    return record


async def list_portfolio_snapshot_certificates(user_id: str, portfolio_id: str) -> list[PortfolioSnapshotCertificateRecord]:
    rows = await select_rows(
        "portfolio_snapshot_certificates",
        params=[
            build_filter_select(CERTIFICATE_SELECT_COLUMNS),
            build_filter_eq("user_id", user_id),
            build_filter_eq("portfolio_id", portfolio_id),
            build_filter_order("snapshot_at", ascending=False),
        ],
    )
    return [PortfolioSnapshotCertificateRecord(**row) for row in rows if isinstance(row, dict)]


async def get_portfolio_snapshot_certificate(certificate_id: str, user_id: str) -> PortfolioSnapshotCertificateRecord | None:
    row = await select_rows(
        "portfolio_snapshot_certificates",
        params=[
            build_filter_select(CERTIFICATE_SELECT_COLUMNS),
            build_filter_eq("id", certificate_id),
            build_filter_eq("user_id", user_id),
            build_filter_limit(1),
        ],
        single=True,
    )
    return _record_from_row(row if isinstance(row, dict) else None)


async def mark_portfolio_snapshot_certificate_verified(
    certificate_id: str,
    user_id: str,
    *,
    verification_status: str,
) -> PortfolioSnapshotCertificateRecord | None:
    verified_at = datetime.now(timezone.utc).isoformat()
    row = await update_rows(
        "portfolio_snapshot_certificates",
        params=[
            build_filter_eq("id", certificate_id),
            build_filter_eq("user_id", user_id),
        ],
        updates={
            "verification_status": verification_status,
            "verified_at": verified_at,
        },
        single=True,
    )
    return _record_from_row(row if isinstance(row, dict) else None)


async def mark_portfolio_snapshot_certificate_minted(
    certificate_id: str,
    user_id: str,
    *,
    token_id: int,
    contract_address: str,
    tx_hash: str,
) -> PortfolioSnapshotCertificateRecord | None:
    row = await update_rows(
        "portfolio_snapshot_certificates",
        params=[
            build_filter_eq("id", certificate_id),
            build_filter_eq("user_id", user_id),
        ],
        updates={
            "nft_mint_status": "minted",
            "nft_token_id": token_id,
            "nft_contract_address": contract_address,
            "nft_tx_hash": tx_hash,
        },
        single=True,
    )
    return _record_from_row(row if isinstance(row, dict) else None)


async def mark_portfolio_snapshot_certificate_mint_failed(
    certificate_id: str,
    user_id: str,
    *,
    error: str,
) -> PortfolioSnapshotCertificateRecord | None:
    row = await update_rows(
        "portfolio_snapshot_certificates",
        params=[
            build_filter_eq("id", certificate_id),
            build_filter_eq("user_id", user_id),
        ],
        updates={
            "nft_mint_status": "failed",
        },
        single=True,
    )
    return _record_from_row(row if isinstance(row, dict) else None)


async def get_certificate_public(certificate_id: str) -> PortfolioSnapshotCertificateRecord | None:
    """Fetch a certificate by ID without requiring user_id (for public NFT metadata endpoint)."""
    row = await select_rows(
        "portfolio_snapshot_certificates",
        params=[
            build_filter_select(CERTIFICATE_SELECT_COLUMNS),
            build_filter_eq("id", certificate_id),
            build_filter_limit(1),
        ],
        single=True,
    )
    return _record_from_row(row if isinstance(row, dict) else None)


async def get_certificate_by_hash(snapshot_hash: str) -> PortfolioSnapshotCertificateRecord | None:
    """Fetch a certificate by snapshot_hash without requiring user_id (for public verification endpoint)."""
    row = await select_rows(
        "portfolio_snapshot_certificates",
        params=[
            build_filter_select(CERTIFICATE_SELECT_COLUMNS),
            build_filter_eq("snapshot_hash", snapshot_hash),
            build_filter_limit(1),
        ],
        single=True,
    )
    return _record_from_row(row if isinstance(row, dict) else None)


async def get_portfolio_snapshot_by_id(snapshot_id: str, user_id: str) -> dict[str, Any] | None:
    row = await select_rows(
        "portfolio_snapshots",
        params=[
            build_filter_select("id,user_id,portfolio_id,snapshot_at,metadata"),
            build_filter_eq("id", snapshot_id),
            build_filter_eq("user_id", user_id),
            build_filter_limit(1),
        ],
        single=True,
    )
    return row if isinstance(row, dict) else None


async def get_latest_portfolio_snapshot(portfolio_id: str, user_id: str) -> dict[str, Any] | None:
    row = await select_rows(
        "portfolio_snapshots",
        params=[
            build_filter_select("id,user_id,portfolio_id,snapshot_at,metadata"),
            build_filter_eq("portfolio_id", portfolio_id),
            build_filter_eq("user_id", user_id),
            build_filter_order("snapshot_at", ascending=False),
            build_filter_limit(1),
        ],
        single=True,
    )
    return row if isinstance(row, dict) else None


async def resolve_portfolio(user_id: str, *, portfolio_id: str | None = None, portfolio_name: str | None = None) -> dict[str, Any] | None:
    params = [
        build_filter_select("id,user_id,name,is_default"),
        build_filter_eq("user_id", user_id),
        build_filter_limit(1),
    ]

    if portfolio_id:
        params.append(build_filter_eq("id", portfolio_id))
    elif portfolio_name:
        params.append(build_filter_eq("name", portfolio_name))
    else:
        return None

    row = await select_rows("portfolios", params=params, single=True)
    return row if isinstance(row, dict) else None
