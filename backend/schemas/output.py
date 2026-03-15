from pydantic import BaseModel, Field
from typing import List, Literal

class TAResult(BaseModel):
    trend: Literal["Bullish", "Bearish", "Neutral"] = Field(
        ..., description="Market trend derived from technical indicators."
    )
    signal_strength: int = Field(
        ge=1, le=10, description="Strength of the signal from 1 (weak) to 10 (strong)."
    )
    reasons: List[str] = Field(
        min_length=2, description="At least two technical reasons supporting the trend and action."
    )
    recommended_action: Literal["Accumulate", "Take Profit", "Stop Loss", "Hold"] = Field(
        ..., description="Suggested action based on TA: Accumulate, Take Profit, Stop Loss, or Hold."
    )

class SentimentResult(BaseModel):
    sentiment_score: int = Field(
        ge=1,
        le=100,
        description="Overall market sentiment score (1 = Extreme Fear, 100 = Extreme Greed).",
    )
    narrative_summary: str = Field(
        ...,
        description="Short natural-language summary of the dominant market narrative based on recent news and sentiment signals.",
    )
    bias: Literal["Bullish", "Bearish", "Neutral"] = Field(
        ...,
        description='High-level sentiment classification: "Bullish", "Bearish", or "Neutral".',
    )

class RiskResult(BaseModel):
    risk_level: Literal["Low", "Moderate", "High", "Critical"]
    recommended_constraints: List[str]

class FinalDecision(BaseModel):
    action: Literal["Accumulate", "Take Profit", "Stop Loss", "Hold"]
    reasoning: str
    
class EvaluationResponse(BaseModel):
    status: str = "success"
    data: dict
