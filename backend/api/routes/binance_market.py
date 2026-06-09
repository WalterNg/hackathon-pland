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

    tickers = {}

    # 1. Try to fetch from Binance Testnet first for the batch
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            resp = await client.get(
                f"{DEMO_BASE_URL}/api/v3/ticker/24hr",
                params={"symbols": json.dumps(symbol_list)},
            )
            resp.raise_for_status()
            for row in resp.json():
                if isinstance(row, dict) and "symbol" in row:
                    tickers[row["symbol"]] = {
                        "lastPrice": row["lastPrice"],
                        "priceChangePercent": row["priceChangePercent"],
                        "quoteVolume": row["quoteVolume"],
                    }
    except Exception as exc:
        logger.warning("[binance-market] batch ticker call failed, falling back to individual price mapping: %s", str(exc))

    # 2. Use CoinGecko fallback for any symbols not supported by Binance Testnet
    from services.binance_connector import BinanceConnector
    _binance_connector = BinanceConnector()
    
    missing_symbols = [s for s in symbol_list if s not in tickers]
    if missing_symbols:
        try:
            cg_prices = await _binance_connector.fetch_price_map(missing_symbols)
            for symbol in missing_symbols:
                price = cg_prices.get(symbol)
                if price is not None and price > 0:
                    tickers[symbol] = {
                        "lastPrice": str(price),
                        "priceChangePercent": "0.0",
                        "quoteVolume": "0.0",
                    }
        except Exception as cg_exc:
            logger.error("[binance-market] CoinGecko fallback failed: %s", str(cg_exc))

    # 3. Use database cache as final fallback
    still_missing = [s for s in symbol_list if s not in tickers]
    if still_missing:
        try:
            from services.supabase_rest import select_rows
            for symbol in still_missing:
                cached_rows = await select_rows("market_prices", params=[f"symbol=eq.{symbol}"])
                if cached_rows and isinstance(cached_rows, list) and len(cached_rows) > 0:
                    price_usd = cached_rows[0].get("price_usd")
                    if price_usd:
                        tickers[symbol] = {
                            "lastPrice": str(price_usd),
                            "priceChangePercent": "0.0",
                            "quoteVolume": "0.0",
                        }
        except Exception as db_exc:
            logger.error("[binance-market] Database price lookup failed: %s", str(db_exc))

    return {"tickers": tickers}
