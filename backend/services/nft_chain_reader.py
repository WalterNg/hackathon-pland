from __future__ import annotations

import logging
from typing import Any

import httpx

from core.config import settings
from services.portfolio_snapshot_certificate_store import (
    CERTIFICATE_SELECT_COLUMNS,
    _record_from_row,
)
from services.supabase_rest import (
    build_filter_eq,
    build_filter_order,
    build_filter_select,
    select_rows,
)

logger = logging.getLogger("hackathon-pland")

try:
    from eth_abi import decode as abi_decode  # type: ignore
    from eth_utils import keccak, to_checksum_address  # type: ignore
except ImportError:
    abi_decode = None  # type: ignore
    keccak = None  # type: ignore
    to_checksum_address = None  # type: ignore

# keccak256("tokenURI(uint256)")[:4]
_TOKEN_URI_SELECTOR: bytes | None = keccak(text="tokenURI(uint256)")[:4] if keccak else None


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

async def _rpc(method: str, params: list[Any]) -> Any:
    rpc_url = settings.eth_sepolia_rpc_url.strip()
    if not rpc_url:
        raise RuntimeError("ETH_SEPOLIA_RPC_URL is not configured.")
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            rpc_url,
            json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        )
    resp.raise_for_status()
    payload = resp.json()
    if payload.get("error"):
        raise RuntimeError(f"RPC error: {payload['error']}")
    return payload.get("result")


def _encode_token_uri_call(token_id: int) -> str:
    """ABI-encode tokenURI(uint256) calldata."""
    if _TOKEN_URI_SELECTOR is None or abi_decode is None:
        raise RuntimeError("eth_abi / eth_utils not installed.")
    from eth_abi import encode as abi_encode  # type: ignore
    encoded_id = abi_encode(["uint256"], [token_id])
    return "0x" + _TOKEN_URI_SELECTOR.hex() + encoded_id.hex()


def _decode_string_result(hex_data: str) -> str:
    """Decode ABI-encoded string response from eth_call."""
    raw = bytes.fromhex(hex_data.removeprefix("0x"))
    (result,) = abi_decode(["string"], raw)  # type: ignore[misc]
    return result


async def _call_token_uri(token_id: int) -> str | None:
    """Call tokenURI(tokenId) on the NFT contract. Returns the URI or None on error."""
    contract = settings.nft_contract_address.strip()
    if not contract or _TOKEN_URI_SELECTOR is None:
        return None
    try:
        calldata = _encode_token_uri_call(token_id)
        result = await _rpc(
            "eth_call",
            [{"to": to_checksum_address(contract), "data": calldata}, "latest"],
        )
        if not result or result == "0x":
            return None
        return _decode_string_result(result)
    except Exception as exc:
        logger.warning("tokenURI(%s) call failed: %s", token_id, exc)
        return None


async def _fetch_snapshot_hash_from_metadata(token_uri: str) -> str | None:
    """Fetch the NFT metadata JSON and extract the snapshot_hash attribute."""
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(token_uri)
        resp.raise_for_status()
        data = resp.json()
        for attr in data.get("attributes", []):
            if attr.get("trait_type") == "snapshot_hash":
                return str(attr["value"])
    except Exception as exc:
        logger.warning("Failed to fetch metadata from %s: %s", token_uri, exc)
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def _list_minted_certs_for_user(user_id: str, portfolio_id: str | None = None) -> list[Any]:
    """Return minted certificates for a user, optionally scoped to one portfolio."""
    params = [
        build_filter_select(CERTIFICATE_SELECT_COLUMNS),
        build_filter_eq("user_id", user_id),
        build_filter_eq("nft_mint_status", "minted"),
        build_filter_order("snapshot_at", ascending=True),
    ]
    if portfolio_id:
        params.append(build_filter_eq("portfolio_id", portfolio_id))
    rows = await select_rows("portfolio_snapshot_certificates", params=params)
    return [_record_from_row(r) for r in rows if isinstance(r, dict)]




async def _verify_record(record: Any) -> dict | None:
    """Fetch tokenURI + metadata for one record concurrently with others."""
    if record is None or record.nft_token_id is None:
        return None

    token_uri = await _call_token_uri(record.nft_token_id)
    on_chain_hash: str | None = None
    hash_verified: bool | None = None

    if token_uri:
        on_chain_hash = await _fetch_snapshot_hash_from_metadata(token_uri)
        if on_chain_hash is not None:
            hash_verified = on_chain_hash == record.snapshot_hash

    return {
        "certificateId": record.id,
        "title": record.title,
        "achievementKey": record.achievement_key,
        "snapshotAt": record.snapshot_at.isoformat() if record.snapshot_at else None,
        "snapshotHash": record.snapshot_hash,
        "nftTokenId": record.nft_token_id,
        "nftTxHash": record.nft_tx_hash,
        "nftContractAddress": record.nft_contract_address,
        "tokenUri": token_uri,
        "onChainHash": on_chain_hash,
        "hashVerified": hash_verified,
        "etherscanUrl": (
            f"https://sepolia.etherscan.io/tx/{record.nft_tx_hash}"
            if record.nft_tx_hash else None
        ),
    }


async def get_user_chain_nfts(user_id: str, portfolio_id: str | None = None) -> list[dict]:
    """
    6.1: Read user's NFT list from chain.
    6.2: Verify each token's snapshot_hash against the DB record.

    Returns all minted certs (both achievement badges and manual certs) with on-chain
    verification. On-chain reads run concurrently.
    """
    import asyncio

    records = await _list_minted_certs_for_user(user_id, portfolio_id=portfolio_id)
    tasks = [_verify_record(r) for r in records]
    results = await asyncio.gather(*tasks, return_exceptions=False)
    return [r for r in results if r is not None]
