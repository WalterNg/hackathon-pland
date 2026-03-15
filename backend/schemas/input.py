from pydantic import BaseModel, Field
from typing import List, Optional

class PortfolioItem(BaseModel):
    asset: str
    amount: float
    current_price: float

class MarketData(BaseModel):
    rvol: float = Field(..., gt=0, description="Relative Volume")
    ma50: float = Field(..., gt=0, description="50-day Moving Average")
    rsi: float = Field(..., ge=0, le=100, description="Relative Strength Index")
    bollinger_bands: str = Field(description="Position relative to Bollinger Bands")
    obv: float = Field(description="On-Balance Volume")

class EvaluationPayload(BaseModel):
    """Input payload for the evaluation graph. Read-only once passed into AgentState."""

    user_id: str = Field(..., description="Identifier of the user whose portfolio is being evaluated.")
    portfolio: List[PortfolioItem] = Field(
        ...,
        description="List of crypto assets held: symbol, quantity, and current price per asset.",
    )
    stablecoin_reserve: float = Field(
        ...,
        ge=0,
        description="Amount of stablecoins (USDT, USDC, etc.) held as reserve, in USD or base unit.",
    )
    market_data: MarketData = Field(
        ...,
        description="Technical indicators for the evaluated market (RVOL, MA50, RSI, Bollinger Bands, OBV). Used by TA agent.",
    )
    news_headlines: List[str] = Field(
        default_factory=list,
        description="Recent news headlines to feed sentiment analysis. Used by sentiment agent.",
    )
    social_dominance: float = Field(
        default=0.0,
        ge=0,
        le=100,
        description="Social/market dominance metric (e.g. 0–100). Used by sentiment or risk agents.",
    )
