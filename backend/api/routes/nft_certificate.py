from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse

from core.config import settings
from services.portfolio_snapshot_certificate_store import (
    get_certificate_by_hash,
    get_certificate_public,
)
from services.supabase_rest import SupabaseRestError, fetch_authenticated_user

router = APIRouter()
logger = logging.getLogger("hackathon-pland")

# ---------------------------------------------------------------------------
# Badge image IPFS CIDs — keyed by achievement_key
# ---------------------------------------------------------------------------
_IMAGE_FOLDER_CID = "bafybeih64xr5ymvnjb6c2pbvohldvit22d2snufeojizeexbch4gutxsii"

_ACHIEVEMENT_IMAGE: dict[str, str] = {
    "diversified_5_assets":  f"ipfs://{_IMAGE_FOLDER_CID}/diversified_5_assets.png",
    "diversified_10_assets": f"ipfs://{_IMAGE_FOLDER_CID}/diversified_10_assets.png",
    "diversified_20_assets": f"ipfs://{_IMAGE_FOLDER_CID}/diversified_20_assets.png",
    "rich_10k":              f"ipfs://{_IMAGE_FOLDER_CID}/rich_10k.png",
    "rich_50k":              f"ipfs://{_IMAGE_FOLDER_CID}/rich_50k.png",
    "rich_100k":             f"ipfs://{_IMAGE_FOLDER_CID}/rich_100k.png",
    "drawdown_guard_10":     f"ipfs://{_IMAGE_FOLDER_CID}/drawdown_guard_10.png",
    "drawdown_guard_5":      f"ipfs://{_IMAGE_FOLDER_CID}/drawdown_guard_5.png",
    "sharpe_1_0":            f"ipfs://{_IMAGE_FOLDER_CID}/sharpe_1_0.png",
    "sharpe_2_0":            f"ipfs://{_IMAGE_FOLDER_CID}/sharpe_2_0.png",
}

_ACHIEVEMENT_TITLE: dict[str, str] = {
    "diversified_5_assets":  "Seed Sower",
    "diversified_10_assets": "Portfolio Gardener",
    "diversified_20_assets": "Allocation Master",
    "rich_10k":              "10K Club",
    "rich_50k":              "50K Club",
    "rich_100k":             "100K Club",
    "drawdown_guard_10":     "Drawdown Guard 10%",
    "drawdown_guard_5":      "Drawdown Guard 5%",
    "sharpe_1_0":            "Sharpe Achiever 1.0",
    "sharpe_2_0":            "Sharpe Achiever 2.0",
}

_ACHIEVEMENT_TIER: dict[str, str] = {
    "diversified_5_assets":  "Bronze",
    "diversified_10_assets": "Silver",
    "diversified_20_assets": "Gold",
    "rich_10k":              "Bronze",
    "rich_50k":              "Silver",
    "rich_100k":             "Gold",
    "drawdown_guard_10":     "Bronze",
    "drawdown_guard_5":      "Silver",
    "sharpe_1_0":            "Bronze",
    "sharpe_2_0":            "Silver",
}

# Purple badge image for manual (non-achievement) certificates
_MANUAL_CERT_IMAGE = f"ipfs://{_IMAGE_FOLDER_CID}/manual_cert.png"


def _image_for(achievement_key: str | None) -> str:
    if achievement_key and achievement_key in _ACHIEVEMENT_IMAGE:
        return _ACHIEVEMENT_IMAGE[achievement_key]
    return _MANUAL_CERT_IMAGE


def _cert_name(achievement_key: str | None, title: str) -> str:
    if achievement_key and achievement_key in _ACHIEVEMENT_TITLE:
        return f"PLAND Achievement Badge — {_ACHIEVEMENT_TITLE[achievement_key]}"
    return f"PLAND Certificate — {title}"


def _external_url(cert_id: str) -> str:
    base = (settings.app_base_url or "https://pland.vercel.app").rstrip("/")
    return f"{base}/portfolio/certificates/{cert_id}"


@router.get("/nft/certificate/{cert_id}")
async def get_nft_certificate_metadata(
    cert_id: str,
    authorization: str | None = Header(default=None),
):
    """
    Public ERC-721 tokenURI metadata endpoint.
    Returns OpenSea-compatible JSON. With a valid PLAND bearer token,
    full portfolio snapshot attributes are included.
    """
    try:
        record = await get_certificate_public(cert_id)
    except SupabaseRestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    if record is None:
        raise HTTPException(status_code=404, detail="Certificate not found.")

    achievement_key = record.achievement_key
    timestamp = record.snapshot_at.isoformat() if record.snapshot_at else None
    tier = _ACHIEVEMENT_TIER.get(achievement_key or "", "Manual") if achievement_key else "Manual"

    attributes: list[dict] = [
        {"trait_type": "snapshot_hash", "value": record.snapshot_hash},
        {"trait_type": "timestamp", "value": timestamp},
        {"trait_type": "tier", "value": tier},
    ]
    if achievement_key:
        attributes.append({"trait_type": "achievement_key", "value": achievement_key})

    # Story 4.2: authenticated PLAND user gets full portfolio state
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        try:
            user = await fetch_authenticated_user(token)
            user_id = str(user.get("id", "")).strip() if isinstance(user, dict) else ""
            if user_id and record.user_id == user_id:
                payload = record.snapshot_payload or {}
                metrics = payload.get("metrics", {})
                summary = payload.get("summary", {})
                assets = payload.get("assets", [])

                extended: list[dict] = []
                for key, label in [
                    ("total_value_usd", "total_value_usd"),
                    ("distinct_assets", "distinct_assets"),
                    ("sharpe_ratio_30d", "sharpe_ratio_30d"),
                    ("max_drawdown_percent", "max_drawdown_percent"),
                ]:
                    val = metrics.get(key) or summary.get(key)
                    if val is not None:
                        extended.append({"trait_type": label, "value": val})

                extended.append({"trait_type": "asset_count", "value": len(assets)})
                attributes.extend(extended)
        except Exception:
            # Auth failure is non-fatal — fall back to public metadata
            pass

    metadata = {
        "name": _cert_name(achievement_key, record.title),
        "description": record.note or "A PLAND portfolio certificate anchored on Ethereum Sepolia.",
        "image": _image_for(achievement_key),
        "external_url": _external_url(cert_id),
        "attributes": attributes,
    }

    return JSONResponse(content=metadata, media_type="application/json")


@router.get("/certificates/verify")
async def verify_certificate_by_hash(
    hash: str | None = None,
    authorization: str | None = Header(default=None),
):
    """
    Public endpoint: look up a certificate by its snapshot_hash and return on-chain proof.
    With a valid PLAND bearer token belonging to the certificate owner, the full
    snapshot_payload (assets, metrics) is also returned.
    """
    if not hash or not hash.strip():
        raise HTTPException(status_code=422, detail="hash query parameter is required.")

    try:
        record = await get_certificate_by_hash(hash.strip())
    except SupabaseRestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    if record is None:
        raise HTTPException(status_code=404, detail="No certificate found for this hash.")

    result: dict = {
        "certificateId": record.id,
        "title": record.title,
        "achievementKey": record.achievement_key,
        "snapshotAt": record.snapshot_at.isoformat() if record.snapshot_at else None,
        "snapshotHash": record.snapshot_hash,
        "nftMintStatus": record.nft_mint_status,
        "nftTokenId": record.nft_token_id,
        "nftTxHash": record.nft_tx_hash,
        "nftContractAddress": record.nft_contract_address,
        "externalUrl": _external_url(record.id),
        "snapshotPayload": None,
    }

    # Return full portfolio state to the authenticated owner (story 5.4)
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        try:
            user = await fetch_authenticated_user(token)
            user_id = str(user.get("id", "")).strip() if isinstance(user, dict) else ""
            if user_id and record.user_id == user_id:
                result["snapshotPayload"] = record.snapshot_payload
        except Exception:
            pass

    return JSONResponse(content=result, media_type="application/json")
