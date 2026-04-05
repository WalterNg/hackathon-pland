from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class TradingPortfolioItem(BaseModel):
    asset: str
    amount: float = Field(..., ge=0)
    current_price: float = Field(..., ge=0)


class TradingAgentRequest(BaseModel):
    user_id: str = Field(..., description="Identifier of the user whose portfolio is being evaluated.")
    portfolio: List[TradingPortfolioItem] = Field(..., description="List of portfolio assets to analyze.")
    stablecoin_reserve: float = Field(default=0.0, ge=0)
    news_headlines: List[str] = Field(default_factory=list)
    social_dominance: float = Field(default=0.0, ge=0, le=100)


class TradingAgentMeta(BaseModel):
    user_id: str
    portfolio_id: str
    as_of: str
    symbols: List[str]
    portfolio_snapshot: Optional[List[TradingPortfolioItem]] = None
    workflow_version: str = "trading_agent_v1"


class PositionSnapshot(BaseModel):
    symbol: str
    weight: float = Field(..., ge=0, le=1)
    quantity: float = Field(..., ge=0)
    current_price: float = Field(..., ge=0)
    value_usd: float = Field(..., ge=0)


class AssetTechnicalSnapshot(BaseModel):
    symbol: str
    rsi: float = Field(..., ge=0, le=100)
    ma50_gap_pct: float
    bollinger_position: Literal["Upper", "Middle", "Lower"]
    rvol: float = Field(..., ge=0)
    obv_trend: Literal["Up", "Flat", "Down"]
    trend: Literal["Bullish", "Neutral", "Bearish"]
    signal_strength: int = Field(..., ge=1, le=10)


class PortfolioTechnicalSummary(BaseModel):
    weighted_avg_rsi: float = Field(..., ge=0, le=100)
    bullish_weight_ratio: float = Field(..., ge=0, le=1)
    bearish_weight_ratio: float = Field(..., ge=0, le=1)
    above_ma50_weight_ratio: float = Field(..., ge=0, le=1)
    high_rvol_weight_ratio: float = Field(..., ge=0, le=1)
    technical_breadth: str


class BenchmarkContext(BaseModel):
    primary_symbol: Optional[str] = None
    primary_trend: Literal["Bullish", "Neutral", "Bearish"] = "Neutral"
    market_regime: Literal["Risk-on", "Neutral", "Risk-off"] = "Neutral"


class TechnicalContext(BaseModel):
    cash_ratio: float = Field(..., ge=0, le=1)
    positions: List[PositionSnapshot] = Field(default_factory=list)
    per_asset_signals: List[AssetTechnicalSnapshot] = Field(default_factory=list)
    portfolio_technical_summary: PortfolioTechnicalSummary
    benchmark_context: BenchmarkContext


class NewsContext(BaseModel):
    portfolio_symbols: List[str] = Field(default_factory=list)
    news_headlines: List[str] = Field(default_factory=list)
    dominant_narrative: str
    macro_context: dict = Field(default_factory=dict)


class SentimentContext(BaseModel):
    social_sentiment_score: float = Field(..., ge=0, le=100)
    dominant_narrative: str
    sentiment_label: Literal["Bullish", "Neutral", "Bearish"]


class PortfolioStructureContext(BaseModel):
    cash_ratio: float = Field(..., ge=0, le=1)
    positions: List[PositionSnapshot] = Field(default_factory=list)
    top1_weight: float = Field(..., ge=0, le=1)
    top2_weight: float = Field(..., ge=0, le=1)
    concentration_score: float = Field(..., ge=0)
    estimated_volatility: float = Field(..., ge=0)
    liquidity_condition: Literal["Tight", "Normal", "Loose"] = "Normal"


class PortfolioContext(BaseModel):
    technical: TechnicalContext
    news: NewsContext
    sentiment: SentimentContext
    structure: PortfolioStructureContext
