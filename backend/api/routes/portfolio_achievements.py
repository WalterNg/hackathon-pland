from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query

from api.routes.portfolio_snapshot_certificates import _require_user_id
from schemas.achievement import PortfolioAchievementAutoCertifyRequest
from services.portfolio_achievement import PortfolioAchievementService
from services.portfolio_snapshot_certificate import PortfolioSnapshotCertificateService
from services.supabase_rest import SupabaseRestError

router = APIRouter()
_achievement_service = PortfolioAchievementService()
_certificate_service = PortfolioSnapshotCertificateService()


@router.get("/portfolio_achievements")
async def list_portfolio_achievements(
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
        response = await _achievement_service.list_unlocked_achievements(user_id, str(portfolio["id"]))
    except SupabaseRestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    return response.model_dump(by_alias=True)


@router.get("/achievements/catalog")
async def list_achievement_catalog(authorization: str | None = Header(default=None)):
    # require auth so we keep behavior aligned with other portfolio APIs
    await _require_user_id(authorization)
    try:
        achievements = await _achievement_service.list_achievement_catalog()
    except SupabaseRestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    return {"achievements": [item.model_dump(by_alias=True) for item in achievements]}


@router.post("/portfolio_achievements/auto_certify")
async def auto_certify_portfolio_achievements(
    payload: PortfolioAchievementAutoCertifyRequest,
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

    if payload.snapshot_payload is None:
        raise HTTPException(status_code=422, detail="snapshotPayload is required.")

    try:
        created = await _achievement_service.auto_certify_achievements(
            user_id=user_id,
            portfolio_id=str(portfolio["id"]),
            snapshot_payload=payload.snapshot_payload,
        )
    except SupabaseRestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {
        "createdCount": len(created),
        "createdUnlocks": [item.model_dump(by_alias=True) for item in created],
    }
