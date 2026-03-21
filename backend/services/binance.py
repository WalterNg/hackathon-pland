import logging
from typing import List, Tuple

import httpx
from schemas.input import MarketData

from .ta_indicators import TAIndicators

logger = logging.getLogger("hackathon-pland")


# ---------------------------------------------------------------------------
# Pure helpers (no I/O) – easy to test and reuse
# ---------------------------------------------------------------------------

def _float(s: str | float, default: float = 0.0) -> float:
    try:
        v = float(s)
        return v if v == v else default  # NaN check
    except (TypeError, ValueError):
        return default


def _parse_klines_rows(rows: list, idx: type) -> List[Tuple[float, float, float]]:
    """Parse Binance-style kline rows into (close, volume, high) per candle."""
    out: List[Tuple[float, float, float]] = []
    for row in rows:
        close = _float(row[idx.CLOSE])
        volume = _float(row[idx.VOLUME])
        high = _float(row[idx.HIGH])
        out.append((close, volume, high))
    return out


# ---------------------------------------------------------------------------
# Service (I/O + config + orchestration)
# ---------------------------------------------------------------------------

class BinanceService:
    """
    Handles Binance data (klines, etc.). Used by TA agent and other features.
    Config is set once at construction.
    """

    BASE_URL = "https://api.binance.com"
    ENDPOINT = f"{BASE_URL}/api/v3/klines"
    DEFAULT_INTERVAL = "1d"
    DEFAULT_LIMIT = 120

    class Idx:
        """Binance kline array indices (openTime, open, high, low, close, volume, ...)."""
        OPEN_TIME = 0
        OPEN = 1
        HIGH = 2
        LOW = 3
        CLOSE = 4
        VOLUME = 5

    def __init__(
        self,
        timeout: float = 30.0,
        default_interval: str | None = None,
        default_limit: int | None = None,
    ):
        self.timeout = timeout
        self.default_interval = default_interval or self.DEFAULT_INTERVAL
        self.default_limit = default_limit or self.DEFAULT_LIMIT

    async def fetch_klines(
        self,
        symbol: str,
        interval: str | None = None,
        limit: int | None = None,
    ) -> List[Tuple[float, float, float]]:
        """
        Fetch klines from Binance and return parsed (close, volume, high) per candle.
        Used by build_market_data (TA agent).
        """
        interval = interval or self.default_interval
        limit = limit or self.default_limit
        symbol = symbol.upper()
        params = {"symbol": symbol, "interval": interval, "limit": limit}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(self.ENDPOINT, params=params)
            resp.raise_for_status()
        return _parse_klines_rows(resp.json(), self.Idx)

    async def build_market_data(
        self,
        symbol: str = "BTCUSDT",
        interval: str | None = None,
        limit: int | None = None,
    ) -> MarketData:
        """
        Fetch klines and compute TA indicators (RVOL, MA50, RSI, Bollinger Bands, OBV).
        """
        klines = await self.fetch_klines(symbol, interval=interval, limit=limit)
        if not klines:
            raise ValueError(f"No klines returned for symbol={symbol}")

        closes = [c for c, _, _ in klines]
        volumes = [v for _, v, _ in klines]

        ma50 = TAIndicators.ma50(closes)
        if ma50 <= 0:
            ma50 = closes[-1] if closes else 1.0  # fallback so MarketData.rvol/ma50 > 0

        rvol = TAIndicators.rvol(volumes)
        if rvol <= 0:
            rvol = 1.0  # MarketData requires rvol > 0

        rsi = TAIndicators.rsi(closes)
        bb_position = TAIndicators.bollinger_position(closes)
        obv = TAIndicators.obv(closes, volumes)

        return MarketData(
            rvol=rvol,
            ma50=round(ma50, 4),
            rsi=round(rsi, 2),
            bollinger_bands=bb_position,
            obv=round(obv, 4),
        )


# ---------------------------------------------------------------------------
# Convenience (backward compatibility)
# ---------------------------------------------------------------------------

async def build_market_data_from_binance(
    symbol: str = "BTCUSDT",
    interval: str = BinanceService.DEFAULT_INTERVAL,
    limit: int = BinanceService.DEFAULT_LIMIT,
) -> MarketData:
    """
    One-off: build MarketData using a temporary BinanceService.
    For repeated calls, instantiate BinanceService once and use build_market_data().
    """
    service = BinanceService()
    return await service.build_market_data(symbol=symbol, interval=interval, limit=limit)
