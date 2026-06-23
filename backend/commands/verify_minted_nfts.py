"""
Verify all minted NFTs by cross-checking DB records against on-chain data.

For each minted certificate:
  - Calls tokenURI(tokenId) on the contract to confirm the token exists on-chain
  - Fetches the metadata JSON and checks snapshot_hash matches DB
  - Prints Etherscan link for manual inspection

Usage:
    cd backend
    python commands/verify_minted_nfts.py              # quick: DB summary only
    python commands/verify_minted_nfts.py --onchain    # full on-chain verification (slower)
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.nft_chain_reader import _call_token_uri, _fetch_snapshot_hash_from_metadata
from services.portfolio_snapshot_certificate_store import list_all_minted_certificates

ETHERSCAN_TX = "https://sepolia.etherscan.io/tx"
ETHERSCAN_TOKEN = "https://sepolia.etherscan.io/nft"


async def main(*, onchain: bool) -> None:
    print("Fetching minted certificates from DB...")
    certs = await list_all_minted_certificates()

    if not certs:
        print("No minted certificates found.")
        return

    print(f"Found {len(certs)} minted certificate(s).\n")
    print(f"  {'TOKEN_ID':<10}  {'CERT_ID':<38}  {'ACHIEVEMENT':<26}  TX")
    print(f"  {'-'*10}  {'-'*38}  {'-'*26}  {'-'*20}")

    for c in certs:
        achievement = (c.achievement_key or "manual")[:26]
        tx_preview = (c.nft_tx_hash or "")[:20] + "..." if c.nft_tx_hash else "-"
        print(f"  {str(c.nft_token_id):<10}  {c.id:<38}  {achievement:<26}  {tx_preview}")

    print(f"\nEtherscan contract: https://sepolia.etherscan.io/address/{certs[0].nft_contract_address}")

    if not onchain:
        print("\n[quick mode] Pass --onchain to verify each token on-chain.")
        print("\nEtherscan links:")
        for c in certs:
            if c.nft_tx_hash:
                print(f"  token #{c.nft_token_id:<5}  {ETHERSCAN_TX}/{c.nft_tx_hash}")
        return

    # ── On-chain verification ─────────────────────────────────────────────────
    print(f"\nVerifying {len(certs)} token(s) on-chain...\n")
    print(f"  {'TOKEN_ID':<10}  {'ON_CHAIN':<10}  {'HASH_MATCH':<12}  CERT_ID")
    print(f"  {'-'*10}  {'-'*10}  {'-'*12}  {'-'*38}")

    verified = mismatched = missing = 0
    for c in certs:
        if c.nft_token_id is None:
            print(f"  {'?':<10}  {'NO_TOKEN':<10}  {'?':<12}  {c.id}")
            missing += 1
            continue

        token_uri = await _call_token_uri(c.nft_token_id)
        if not token_uri:
            print(f"  {str(c.nft_token_id):<10}  {'NOT FOUND':<10}  {'?':<12}  {c.id}")
            missing += 1
            continue

        on_chain_hash = await _fetch_snapshot_hash_from_metadata(token_uri)
        if on_chain_hash is None:
            hash_status = "NO_METADATA"
            mismatched += 1
        elif on_chain_hash == c.snapshot_hash:
            hash_status = "MATCH"
            verified += 1
        else:
            hash_status = "MISMATCH"
            mismatched += 1

        print(f"  {str(c.nft_token_id):<10}  {'EXISTS':<10}  {hash_status:<12}  {c.id}")

    print(f"\nDone.  {verified} verified  |  {mismatched} hash mismatch/missing metadata  |  {missing} not found on-chain")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify minted NFTs against on-chain data.")
    parser.add_argument("--onchain", action="store_true", help="Full on-chain tokenURI + hash verification (slower)")
    args = parser.parse_args()

    asyncio.run(main(onchain=args.onchain))
