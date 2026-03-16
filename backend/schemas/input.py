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
    user_id: str
    portfolio: List[PortfolioItem]
    stablecoin_reserve: float = Field(..., ge=0)
    market_data: MarketData
    news_headlines: List[str] = Field(default_factory=list)
    social_dominance: float = Field(default=0.0, ge=0, le=100)
