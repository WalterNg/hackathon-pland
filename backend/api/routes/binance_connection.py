import logging

from fastapi import APIRouter, HTTPException

from schemas.input import BinanceConnectionPreviewRequest
from schemas.output import BinanceConnectedPositionsResponse, BinanceConnectionPreviewResponse
from services.binance_connector import BinanceConnector, BinanceConnectorError

router = APIRouter()
logger = logging.getLogger("hackathon-pland")
_binance_connector = BinanceConnector()


@router.post("/binance/connection/preview", response_model=BinanceConnectionPreviewResponse)
async def preview_binance_connection(payload: BinanceConnectionPreviewRequest):
    logger.info(
        "Received Binance connection preview request | mode=%s | zero_balances=%s",
        payload.mode,
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
        "Received Binance connected positions request | mode=%s | zero_balances=%s",
        payload.mode,
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
