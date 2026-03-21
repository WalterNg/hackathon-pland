from typing import List, Literal

from pydantic import BaseModel, Field


class PortfolioTAResult(BaseModel):
    portfolio_trend: Literal["Bullish", "Bearish", "Neutral"]
    signal_strength: int = Field(..., ge=1, le=10)
    strongest_positions: List[str] = Field(default_factory=list)
    weakest_positions: List[str] = Field(default_factory=list)
    reasons: List[str] = Field(..., min_length=2)
    recommended_action: Literal["Accumulate", "Hold", "Reduce Risk", "Rebalance"]


class PortfolioNewsMarketResult(BaseModel):
    market_bias: Literal["Bullish", "Bearish", "Neutral"]
    confidence: int = Field(..., ge=1, le=10)
    key_catalysts: List[str] = Field(default_factory=list)
    portfolio_headwinds: List[str] = Field(default_factory=list)
    narrative_summary: str


class PortfolioRiskResult(BaseModel):
    risk_level: Literal["Low", "Moderate", "High", "Critical"]
    risk_alerts: List[str] = Field(default_factory=list)
    recommended_constraints: List[str] = Field(default_factory=list)
    capital_preservation_bias: Literal["Bullish", "Neutral", "Defensive"]


class PortfolioDecision(BaseModel):
    action: Literal["Accumulate", "Hold", "Reduce Risk", "Rebalance", "Stop Loss"]
    confidence: int = Field(..., ge=1, le=10)
    summary: str
    reasoning: List[str] = Field(..., min_length=2)
    portfolio_actions: List[str] = Field(default_factory=list)


class EvaluationResponse(BaseModel):
    status: str = "success"
    data: dict
