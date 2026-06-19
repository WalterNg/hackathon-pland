from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from services.nft_chain_reader import get_user_chain_nfts
from services.storytelling_service import generate_audit_report, generate_share_narrative
from services.supabase_rest import SupabaseRestError, fetch_authenticated_user

router = APIRouter()
logger = logging.getLogger("hackathon-pland")


async def _require_user_id(authorization: str | None) -> str:
    value = (authorization or "").strip()
    if not value.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = value[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        user = await fetch_authenticated_user(token)
    except SupabaseRestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    user_id = str(user.get("id", "")).strip() if isinstance(user, dict) else ""
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user_id


@router.get("/storytelling/nfts")
async def list_user_chain_nfts(
    authorization: str | None = Header(default=None),
):
    """
    6.1 + 6.2: Return the authenticated user's minted NFTs with on-chain verification.
    Each entry includes tokenURI fetched from chain and hash_verified status.
    """
    user_id = await _require_user_id(authorization)

    try:
        nfts = await get_user_chain_nfts(user_id)
    except SupabaseRestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to read NFTs from chain for user=%s", user_id)
        raise HTTPException(status_code=500, detail=f"Chain read failed: {exc}") from exc

    return {"nfts": nfts}


class GenerateStoryRequest(BaseModel):
    mode: Literal["share", "audit"]


@router.post("/storytelling/generate")
async def generate_story(
    body: GenerateStoryRequest,
    authorization: str | None = Header(default=None),
):
    """
    6.3 (share mode): Generate a social-media-ready narrative from on-chain achievements.
    6.4 (audit mode): Generate a structured due-diligence audit report.
    """
    user_id = await _require_user_id(authorization)

    try:
        nfts = await get_user_chain_nfts(user_id)
    except Exception as exc:
        logger.exception("Chain read failed for storytelling (user=%s)", user_id)
        raise HTTPException(status_code=502, detail=f"Could not read NFTs from chain: {exc}") from exc

    if not nfts:
        raise HTTPException(
            status_code=422,
            detail="No minted NFT badges found. Earn achievements first to generate your story.",
        )

    try:
        if body.mode == "share":
            narrative = await generate_share_narrative(nfts)
            return {"mode": "share", "narrative": narrative, "nftCount": len(nfts)}
        else:
            report = await generate_audit_report(nfts)
            return {"mode": "audit", "report": report, "nftCount": len(nfts)}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("LLM storytelling failed (user=%s, mode=%s)", user_id, body.mode)
        raise HTTPException(status_code=500, detail=f"Story generation failed: {exc}") from exc
