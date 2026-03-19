import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from schemas.input import MarketData
from services.binance import BinanceService
from services.portfolio_snapshot import normalize_symbol

router = APIRouter()
logger = logging.getLogger("hackathon-pland")
_binance_service = BinanceService()


class DebugSymbolsPayload(BaseModel):
    symbols: list[str] = Field(..., min_length=1, description="List of symbols or assets, e.g. BTCUSDT or BTC")
    interval: str = Field(default=BinanceService.DEFAULT_INTERVAL)
    limit: int = Field(default=BinanceService.DEFAULT_LIMIT, ge=10, le=1000)


class DebugResponse(BaseModel):
    status: Literal["success", "error"] = "success"
    data: dict


@router.get("/debug/binance/klines", response_model=DebugResponse)
async def debug_binance_klines(
    symbol: str = Query(..., description="Trading pair symbol such as BTCUSDT"),
    interval: str = Query(BinanceService.DEFAULT_INTERVAL),
    limit: int = Query(BinanceService.DEFAULT_LIMIT, ge=10, le=1000),
):
    normalized_symbol = normalize_symbol(symbol)
    logger.info("Debug klines request for symbol=%s interval=%s limit=%s", normalized_symbol, interval, limit)

    try:
        klines = await _binance_service.fetch_klines(
            symbol=normalized_symbol,
            interval=interval,
            limit=limit,
        )
    except Exception as e:
        logger.exception("Failed to fetch Binance klines")
        raise HTTPException(status_code=502, detail=f"Binance klines fetch failed: {str(e)}")

    return DebugResponse(
        data={
            "symbol": normalized_symbol,
            "interval": interval,
            "limit": limit,
            "count": len(klines),
            "latest_candle": {
                "close": klines[-1][0] if klines else None,
                "volume": klines[-1][1] if klines else None,
                "high": klines[-1][2] if klines else None,
            },
            "sample": [
                {"close": close, "volume": volume, "high": high}
                for close, volume, high in klines
            ],
        }
    )


@router.get("/debug/binance/market-data", response_model=DebugResponse)
async def debug_binance_market_data(
    symbol: str = Query(..., description="Trading pair symbol such as BTCUSDT"),
    interval: str = Query(BinanceService.DEFAULT_INTERVAL),
    limit: int = Query(BinanceService.DEFAULT_LIMIT, ge=10, le=1000),
):
    normalized_symbol = normalize_symbol(symbol)
    logger.info("Debug market-data request for symbol=%s interval=%s limit=%s", normalized_symbol, interval, limit)

    try:
        market_data: MarketData = await _binance_service.build_market_data(
            symbol=normalized_symbol,
            interval=interval,
            limit=limit,
        )
    except Exception as e:
        logger.exception("Failed to build market data from Binance")
        raise HTTPException(status_code=502, detail=f"Binance market data build failed: {str(e)}")

    return DebugResponse(
        data={
            "symbol": normalized_symbol,
            "interval": interval,
            "limit": limit,
            "market_data": market_data.model_dump(),
        }
    )


@router.post("/debug/binance/market-data/batch", response_model=DebugResponse)
async def debug_binance_market_data_batch(payload: DebugSymbolsPayload):
    results: dict[str, dict] = {}
    errors: dict[str, str] = {}

    for raw_symbol in payload.symbols:
        normalized_symbol = normalize_symbol(raw_symbol)
        try:
            market_data = await _binance_service.build_market_data(
                symbol=normalized_symbol,
                interval=payload.interval,
                limit=payload.limit,
            )
            results[normalized_symbol] = market_data.model_dump()
        except Exception as e:
            logger.exception("Failed to build market data for symbol=%s", normalized_symbol)
            errors[normalized_symbol] = str(e)

    return DebugResponse(
        data={
            "interval": payload.interval,
            "limit": payload.limit,
            "results": results,
            "errors": errors,
        }
    )
