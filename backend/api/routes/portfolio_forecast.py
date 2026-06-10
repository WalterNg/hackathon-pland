import logging

from fastapi import APIRouter, HTTPException

from schemas.input import PortfolioForecastPayload
from schemas.output import PortfolioForecastResponse
from services.freqai_forecast import ForecastUnavailableError, PortfolioForecastService

router = APIRouter()
logger = logging.getLogger("hackathon-pland")
_forecast_service = PortfolioForecastService()


@router.post("/predict/portfolio", response_model=PortfolioForecastResponse)
async def predict_portfolio(payload: PortfolioForecastPayload) -> PortfolioForecastResponse:
    """Return a normalized 48h portfolio forecast for the supplied holdings."""

    if not payload.portfolio:
        raise HTTPException(status_code=422, detail="Portfolio must contain at least one asset.")

    try:
        forecast = _forecast_service.predict(payload)
    except ForecastUnavailableError as exc:
        logger.warning("Portfolio forecast unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive guard around artifact parsing/runtime issues
        logger.exception("Portfolio forecast failed")
        raise HTTPException(status_code=500, detail=f"Portfolio forecast failed: {exc}") from exc

    return PortfolioForecastResponse(status="success", data=forecast)
