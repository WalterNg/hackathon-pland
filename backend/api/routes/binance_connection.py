import logging
import os

from fastapi import APIRouter, HTTPException

from schemas.input import BinanceConnectionPreviewRequest
from schemas.output import BinanceConnectedPositionsResponse, BinanceConnectionPreviewResponse
from services.binance_connector import BinanceConnector, BinanceConnectorError

router = APIRouter()
logger = logging.getLogger("hackathon-pland")
_binance_connector = BinanceConnector()


@router.get("/binance/connection/demo-credentials")
async def get_demo_credentials():
    api_key = os.getenv("BINANCE_DEMO_API_KEY", "").strip() or os.getenv("BINANCE_API_KEY", "").strip()
    api_secret = os.getenv("BINANCE_DEMO_SECRET_KEY", "").strip() or os.getenv("BINANCE_SECRET_KEY", "").strip()

    if not api_key or not api_secret:
        raise HTTPException(
            status_code=400,
            detail="Demo credentials are missing. Set BINANCE_DEMO_API_KEY and BINANCE_DEMO_SECRET_KEY in the server .env.",
        )

    return {"apiKey": api_key, "apiSecret": api_secret}


@router.post("/binance/connection/preview", response_model=BinanceConnectionPreviewResponse)
async def preview_binance_connection(payload: BinanceConnectionPreviewRequest):
    logger.info(
        "Received Binance connection preview request | zero_balances=%s",
        payload.include_zero_balances,
    )

    try:
        preview = await _binance_connector.build_connection_preview(payload)
    except BinanceConnectorError as exc:
        logger.exception("Binance connection preview failed")
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected Binance connector error")
        raise HTTPException(status_code=500, detail=f"Binance connector failed: {str(exc)}") from exc

    return BinanceConnectionPreviewResponse(status="success", data=preview.model_dump())


@router.post("/binance/connection/positions", response_model=BinanceConnectedPositionsResponse)
async def get_connected_positions(payload: BinanceConnectionPreviewRequest):
    logger.info(
        "Received Binance connection positions request | zero_balances=%s",
        payload.include_zero_balances,
    )

    try:
        positions = await _binance_connector.build_connected_positions(payload)
    except BinanceConnectorError as exc:
        logger.exception("Binance connected positions failed")
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected Binance connector error while building positions")
        raise HTTPException(status_code=500, detail=f"Binance connector failed: {str(exc)}") from exc

    return BinanceConnectedPositionsResponse(status="success", data=positions)
