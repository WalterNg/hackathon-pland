"""
Retry NFT minting for all certificates with status pending_mint or failed.

Strategy:
  1. Submit all transactions sequentially (fast, ~1s each) with manually managed nonces.
  2. Confirm all in parallel — total wait = slowest single tx, not sum of all.

Usage:
    cd backend
    python commands/retry_pending_mints.py           # dry-run (preview only)
    python commands/retry_pending_mints.py --mint     # actually mint
    python commands/retry_pending_mints.py --mint --limit 50
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from eth_account import Account

from core.config import settings
from services.nft_mint_service import NftMintService, NftMintError
from services.portfolio_snapshot_certificate_store import (
    get_unminted_certificates,
    get_portfolio_snapshot_certificate,
    mark_portfolio_snapshot_certificate_minted,
    mark_portfolio_snapshot_certificate_mint_failed,
    save_portfolio_snapshot_certificate_tx_hash,
)


def _token_uri(cert_id: str) -> str:
    base = (settings.app_base_url or "https://pland.vercel.app").rstrip("/")
    return f"{base}/api/nft/certificate/{cert_id}"


async def _confirm_one(
    mint_svc: NftMintService,
    cert_id: str,
    user_id: str,
    tx_hash: str,
) -> str:
    """Confirm one tx and update DB. Returns final status string for display."""
    try:
        result = await mint_svc.confirm(tx_hash)
        await mark_portfolio_snapshot_certificate_minted(
            cert_id, user_id,
            token_id=result.token_id,
            contract_address=result.contract_address,
            tx_hash=result.tx_hash,
        )
        return f"OK  token_id={result.token_id}  tx={tx_hash[:20]}..."
    except NftMintError as exc:
        if "Timed out" in str(exc):
            return f"PENDING  tx still unconfirmed — https://sepolia.etherscan.io/tx/{tx_hash}"
        await mark_portfolio_snapshot_certificate_mint_failed(cert_id, user_id, error=str(exc))
        return f"FAILED  {exc}"
    except Exception as exc:
        await mark_portfolio_snapshot_certificate_mint_failed(cert_id, user_id, error=str(exc))
        return f"FAILED  {exc}"


async def main(*, do_mint: bool, limit: int, force: bool) -> None:
    print("Fetching unminted certificates...")
    certs = await get_unminted_certificates(limit=limit)

    if not certs:
        print("No pending_mint or failed certificates found.")
        return

    print(f"Found {len(certs)} certificate(s):\n")
    print(f"  {'ID':<38}  {'STATUS':<14}  {'TX_HASH'}")
    print(f"  {'-'*38}  {'-'*14}  {'-'*20}")
    for c in certs:
        tx_preview = (c.nft_tx_hash or "")[:20] + "..." if c.nft_tx_hash else "-"
        print(f"  {c.id:<38}  {c.nft_mint_status:<14}  {tx_preview}")

    if not do_mint:
        print("\n[dry-run] Pass --mint to actually trigger minting.")
        return

    mint_svc = NftMintService()
    platform_wallet = Account.from_key(settings.eth_sepolia_private_key.strip()).address

    # Separate certs: those with existing tx (just confirm) vs those needing new tx
    # --force ignores stale tx_hash and resubmits fresh for all
    need_submit = [c for c in certs if not c.nft_tx_hash or force]
    need_confirm_only = [c for c in certs if c.nft_tx_hash and not force]

    # ── Step 1: submit all new txs sequentially with managed nonces ──────────
    submitted: list[tuple[str, str, str]] = []  # (cert_id, user_id, tx_hash)

    if need_submit:
        print(f"\nSubmitting {len(need_submit)} new transaction(s)...")
        base_nonce = await mint_svc.get_base_nonce()
        print(f"  Base nonce: {base_nonce}\n")

        for i, cert in enumerate(need_submit):
            nonce = base_nonce + i
            print(f"  [{i+1}/{len(need_submit)}] Submitting {cert.id} (nonce={nonce}) ...", end=" ", flush=True)
            try:
                tx_hash = await mint_svc.submit(
                    to_address=platform_wallet,
                    token_uri=_token_uri(cert.id),
                    nonce=nonce,
                )
                await save_portfolio_snapshot_certificate_tx_hash(cert.id, cert.user_id, tx_hash=tx_hash)
                submitted.append((cert.id, cert.user_id, tx_hash))
                print(f"sent  {tx_hash[:20]}...")
            except Exception as exc:
                print(f"ERROR  {exc}")
                await mark_portfolio_snapshot_certificate_mint_failed(cert.id, cert.user_id, error=str(exc))

    # Re-queue existing-tx certs for confirmation
    for cert in need_confirm_only:
        submitted.append((cert.id, cert.user_id, cert.nft_tx_hash))

    if not submitted:
        print("\nNothing to confirm.")
        return

    # ── Step 2: confirm all in parallel ──────────────────────────────────────
    print(f"\nWaiting for {len(submitted)} confirmation(s) in parallel...\n")

    async def _task(cert_id: str, user_id: str, tx_hash: str) -> tuple[str, str]:
        status = await _confirm_one(mint_svc, cert_id, user_id, tx_hash)
        return cert_id, status

    results = await asyncio.gather(*[_task(cid, uid, tx) for cid, uid, tx in submitted])

    ok = pending = failed = 0
    for cert_id, status in results:
        tag = status.split()[0]
        if tag == "OK":
            ok += 1
        elif tag == "PENDING":
            pending += 1
        else:
            failed += 1
        print(f"  {cert_id}  {status}")

    print(f"\nDone.  {ok} minted  |  {pending} still pending on-chain  |  {failed} failed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Retry pending/failed NFT mints.")
    parser.add_argument("--mint", action="store_true", help="Actually trigger minting (default: dry-run)")
    parser.add_argument("--limit", type=int, default=200, help="Max certificates to process (default: 200)")
    parser.add_argument("--force", action="store_true", help="Ignore existing tx_hash and resubmit fresh (use when old tx is dropped/stuck)")
    args = parser.parse_args()

    asyncio.run(main(do_mint=args.mint, limit=args.limit, force=args.force))
