import json
import logging

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()
logger = logging.getLogger("hackathon-pland")

DEMO_BASE_URL = "https://demo-api.binance.com"
DEFAULT_TIMEOUT = 15.0


@router.get("/binance/market/klines")
async def get_klines(
    symbol: str = Query(..., description="Trading pair, e.g. BTCUSDT"),
    interval: str = Query("1d"),
    limit: int = Query(1000, ge=1, le=1000),
    startTime: int | None = Query(None, description="Start time in milliseconds"),
):
    """Return klines as [{openTime, closePrice}] for portfolio chart building."""
    params: dict = {"symbol": symbol.upper(), "interval": interval, "limit": limit}
    if startTime is not None:
        params["startTime"] = startTime

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            resp = await client.get(f"{DEMO_BASE_URL}/api/v3/klines", params=params)
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("[binance-market] klines failed: %s %s", exc.response.status_code, symbol)
        raise HTTPException(status_code=502, detail=f"Binance klines failed ({exc.response.status_code})") from exc
    except Exception as exc:
        logger.exception("[binance-market] klines error for %s", symbol)
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    rows = resp.json()
    klines = [{"openTime": row[0], "closePrice": float(row[4])} for row in rows]
    return {"symbol": symbol.upper(), "interval": interval, "klines": klines}


@router.get("/binance/market/tickers")
async def get_tickers(
    symbols: str = Query(..., description="Comma-separated symbols, e.g. BTCUSDT,ETHUSDT"),
):
    """Return 24hr ticker data keyed by symbol."""
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        raise HTTPException(status_code=400, detail="No symbols provided")

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            resp = await client.get(
                f"{DEMO_BASE_URL}/api/v3/ticker/24hr",
                params={"symbols": json.dumps(symbol_list)},
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("[binance-market] tickers failed: %s", exc.response.status_code)
        raise HTTPException(status_code=502, detail=f"Binance tickers failed ({exc.response.status_code})") from exc
    except Exception as exc:
        logger.exception("[binance-market] tickers error")
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    tickers = {
        row["symbol"]: {
            "lastPrice": row["lastPrice"],
            "priceChangePercent": row["priceChangePercent"],
            "quoteVolume": row["quoteVolume"],
        }
        for row in resp.json()
        if isinstance(row, dict) and "symbol" in row
    }
    return {"tickers": tickers}
