"""
Technical analysis indicators: MA50, RSI, Bollinger Bands, OBV, RVOL.
Pure functions (no I/O); use as TAIndicators.ma50(closes), etc.
"""
from typing import List


class TAIndicators:
    """
    Static methods for technical indicators used by the TA agent.
    All take list(s) of floats and return a single value or label.
    """

    @staticmethod
    def ma50(closes: List[float]) -> float:
        """50-period simple moving average of close. Uses last 50 values."""
        if len(closes) < 50:
            n = len(closes) if closes else 1
            return sum(closes) / n if n else 0.0
        return sum(closes[-50:]) / 50.0

    @staticmethod
    def rsi(closes: List[float], period: int = 14) -> float:
        """RSI (Relative Strength Index) with Wilder smoothing. Returns 0–100."""
        if len(closes) < period + 1:
            return 50.0
        gains: List[float] = []
        losses: List[float] = []
        for i in range(len(closes) - period, len(closes)):
            ch = closes[i] - closes[i - 1]
            if ch > 0:
                gains.append(ch)
                losses.append(0.0)
            else:
                gains.append(0.0)
                losses.append(-ch)
        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        rsi = 100.0 - (100.0 / (1.0 + rs))
        return max(0.0, min(100.0, rsi))

    @staticmethod
    def bollinger_position(
        closes: List[float],
        period: int = 20,
        num_std: float = 2.0,
    ) -> str:
        """
        Bollinger Bands: SMA(period) ± num_std * std.
        Returns 'Upper' | 'Middle' | 'Lower' based on latest close vs bands.
        """
        if len(closes) < period:
            return "Middle"
        window = closes[-period:]
        mean = sum(window) / period
        variance = sum((x - mean) ** 2 for x in window) / period
        std = variance ** 0.5 if variance > 0 else 0.0
        upper = mean + num_std * std
        lower = mean - num_std * std
        last = closes[-1]
        if std == 0:
            return "Middle"
        if last >= upper:
            return "Upper"
        if last <= lower:
            return "Lower"
        return "Middle"

    @staticmethod
    def obv(closes: List[float], volumes: List[float]) -> float:
        """On-Balance Volume: cumulative volume * sign(close - prev_close). Returns latest OBV."""
        if len(closes) < 2 or len(volumes) < 2 or len(closes) != len(volumes):
            return float(volumes[0]) if volumes else 0.0
        obv = 0.0
        for i in range(1, len(closes)):
            if closes[i] > closes[i - 1]:
                obv += volumes[i]
            elif closes[i] < closes[i - 1]:
                obv -= volumes[i]
        return obv

    @staticmethod
    def rvol(volumes: List[float], lookback: int = 20) -> float:
        """Relative Volume: current period volume / average of previous lookback periods. > 1 = above average."""
        if len(volumes) < lookback + 1:
            avg = sum(volumes) / len(volumes) if volumes else 1.0
            cur = volumes[-1] if volumes else 1.0
            return cur / avg if avg > 0 else 1.0
        cur = volumes[-1]
        prev = volumes[-(lookback + 1) : -1]
        avg = sum(prev) / lookback
        return (cur / avg) if avg > 0 else 1.0
