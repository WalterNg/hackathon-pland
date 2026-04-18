from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException, Query

from schemas.portfolio_snapshot_certificate import PortfolioSnapshotCertificateCreateRequest
from services.portfolio_snapshot_certificate import PortfolioSnapshotCertificateService
from services.supabase_rest import SupabaseRestError, fetch_authenticated_user

router = APIRouter()
logger = logging.getLogger("hackathon-pland")
_certificate_service = PortfolioSnapshotCertificateService()


def _extract_bearer_token(authorization: str | None) -> str:
    value = (authorization or "").strip()
    if not value.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = value[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return token


async def _require_user_id(authorization: str | None) -> str:
    token = _extract_bearer_token(authorization)
    try:
        user = await fetch_authenticated_user(token)
    except SupabaseRestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    user_id = str(user.get("id", "")).strip() if isinstance(user, dict) else ""
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user_id


@router.post("/portfolio_snapshot_certificates")
async def create_portfolio_snapshot_certificate(
    payload: PortfolioSnapshotCertificateCreateRequest,
    authorization: str | None = Header(default=None),
):
    user_id = await _require_user_id(authorization)

    portfolio = await _certificate_service.resolve_portfolio_for_user(
        user_id,
        portfolio_id=payload.portfolio_id,
        portfolio_name=payload.portfolio_name,
    )
    if not portfolio or not portfolio.get("id"):
        raise HTTPException(status_code=404, detail="Portfolio not found.")

    try:
        detail = await _certificate_service.issue_certificate(
            user_id=user_id,
            portfolio_id=str(portfolio["id"]),
            snapshot_payload=payload.snapshot_payload,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except SupabaseRestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to issue portfolio snapshot certificate")
        raise HTTPException(status_code=500, detail=f"Unable to issue portfolio snapshot certificate: {str(exc)}") from exc

    return detail.model_dump(by_alias=True)


@router.get("/portfolio_snapshot_certificates")
async def list_portfolio_snapshot_certificates(
    portfolio_id: str | None = Query(default=None, alias="portfolio_id"),
    portfolio_name: str | None = Query(default=None, alias="portfolio_name"),
    authorization: str | None = Header(default=None),
):
    user_id = await _require_user_id(authorization)
    portfolio = await _certificate_service.resolve_portfolio_for_user(
        user_id,
        portfolio_id=portfolio_id,
        portfolio_name=portfolio_name,
    )
    if not portfolio or not portfolio.get("id"):
        raise HTTPException(status_code=404, detail="Portfolio not found.")

    try:
        certificates = await _certificate_service.list_certificates(user_id, str(portfolio["id"]))
    except SupabaseRestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    return {"certificates": [item.model_dump(by_alias=True) for item in certificates]}


@router.get("/portfolio_snapshot_certificates/{certificate_id}")
async def get_portfolio_snapshot_certificate(
    certificate_id: str,
    authorization: str | None = Header(default=None),
):
    user_id = await _require_user_id(authorization)
    try:
        certificate = await _certificate_service.get_certificate(user_id, certificate_id)
    except SupabaseRestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    if certificate is None:
        raise HTTPException(status_code=404, detail="Certificate not found.")

    return certificate.model_dump(by_alias=True)


@router.post("/portfolio_snapshot_certificates/{certificate_id}/verify")
async def verify_portfolio_snapshot_certificate(
    certificate_id: str,
    authorization: str | None = Header(default=None),
):
    user_id = await _require_user_id(authorization)
    try:
        result = await _certificate_service.verify_certificate(user_id, certificate_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SupabaseRestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return result.model_dump(by_alias=True)
