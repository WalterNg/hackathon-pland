from pydantic import BaseModel, Field
from typing import List, Literal

class TAResult(BaseModel):
    trend: Literal["Bullish", "Bearish", "Neutral"]
    signal_strength: int = Field(ge=1, le=10)
    reasons: List[str] = Field(min_length=2)
    recommended_action: Literal["Accumulate", "Take Profit", "Stop Loss", "Hold"]

class SentimentResult(BaseModel):
    sentiment_score: int = Field(ge=1, le=100)
    narrative_summary: str
    bias: Literal["Bullish", "Bearish", "Neutral"]

class RiskResult(BaseModel):
    risk_level: Literal["Low", "Moderate", "High", "Critical"]
    recommended_constraints: List[str]

class FinalDecision(BaseModel):
    action: Literal["Accumulate", "Take Profit", "Stop Loss", "Hold"]
    reasoning: str
    
class EvaluationResponse(BaseModel):
    status: str = "success"
    data: dict
