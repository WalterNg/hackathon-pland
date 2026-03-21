from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class PortfolioItem(BaseModel):
    asset: str
    amount: float
    current_price: float


class MarketData(BaseModel):
    rvol: float = Field(..., gt=0, description="Relative Volume")
    ma50: float = Field(..., gt=0, description="50-day Moving Average")
    rsi: float = Field(..., ge=0, le=100, description="Relative Strength Index")
    bollinger_bands: Literal["Upper", "Middle", "Lower"]
    obv: float = Field(description="On-Balance Volume")


class EvaluationPayload(BaseModel):
    """Public API request used to analyze a portfolio."""

    user_id: str = Field(..., description="Identifier of the user whose portfolio is being evaluated.")
    portfolio: List[PortfolioItem] = Field(
        ...,
        description="List of crypto assets held: symbol, quantity, and current price per asset.",
    )
    stablecoin_reserve: float = Field(
        ...,
        ge=0,
        description="Amount of stablecoins held as reserve, in USD or base unit.",
    )
    news_headlines: List[str] = Field(
        default_factory=list,
        description="Recent news headlines used by the news or market agent.",
    )
    social_dominance: float = Field(
        default=0.0,
        ge=0,
        le=100,
        description="Portfolio-level market sentiment proxy from 0 to 100.",
    )


class GraphMeta(BaseModel):
    user_id: str
    portfolio_id: str
    as_of: str
    symbols: List[str]


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


class PortfolioTAInput(BaseModel):
    cash_ratio: float = Field(..., ge=0, le=1)
    positions: List[PositionSnapshot]
    per_asset_signals: List[AssetTechnicalSnapshot]
    portfolio_technical_summary: PortfolioTechnicalSummary
    benchmark_context: BenchmarkContext


class PortfolioNewsMarketInput(BaseModel):
    portfolio_symbols: List[str]
    news_headlines: List[str] = Field(default_factory=list)
    social_sentiment_score: float = Field(..., ge=0, le=100)
    dominant_narrative: str
    macro_context: dict = Field(default_factory=dict)


class PortfolioMetrics(BaseModel):
    asset_count: int = Field(..., ge=0)
    top1_weight: float = Field(..., ge=0, le=1)
    top2_weight: float = Field(..., ge=0, le=1)
    concentration_score: float = Field(..., ge=0, le=1)
    estimated_volatility: float = Field(..., ge=0)


class TechnicalRiskSignals(BaseModel):
    bearish_weight_ratio: float = Field(..., ge=0, le=1)
    weak_trend_concentration: float = Field(..., ge=0, le=1)
    high_rvol_weight_ratio: float = Field(..., ge=0, le=1)


class MarketRiskContext(BaseModel):
    market_regime: Literal["Risk-on", "Neutral", "Risk-off"] = "Neutral"
    liquidity_condition: Literal["Tight", "Normal", "Loose"] = "Normal"


class PortfolioRiskInput(BaseModel):
    cash_ratio: float = Field(..., ge=0, le=1)
    positions: List[PositionSnapshot]
    portfolio_metrics: PortfolioMetrics
    technical_risk_signals: TechnicalRiskSignals
    market_risk_context: MarketRiskContext
