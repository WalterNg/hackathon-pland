from typing import List, Literal, Union

from pydantic import BaseModel, Field

class SentimentText(BaseModel):
    text: str
    sentiment: Literal["Bullish", "Bearish", "Neutral"]


class TechnicalAnalysisReport(BaseModel):
    portfolio_trend: Literal["Bullish", "Bearish", "Neutral"]
    signal_strength: int = Field(..., ge=1, le=10)
    strongest_positions: List[str] = Field(default_factory=list)
    weakest_positions: List[str] = Field(default_factory=list)
    summary: str
    evidence: List[Union[str, SentimentText]] = Field(default_factory=list)


class NewsAnalysisReport(BaseModel):
    market_bias: Literal["Bullish", "Bearish", "Neutral"]
    confidence: int = Field(..., ge=1, le=10)
    catalysts: List[Union[str, SentimentText]] = Field(default_factory=list)
    headwinds: List[Union[str, SentimentText]] = Field(default_factory=list)
    summary: str


class SentimentAnalysisReport(BaseModel):
    sentiment_bias: Literal["Bullish", "Bearish", "Neutral"]
    confidence: int = Field(..., ge=1, le=10)
    drivers: List[Union[str, SentimentText]] = Field(default_factory=list)
    summary: str


class PortfolioStructureReport(BaseModel):
    diversification_view: Literal["Healthy", "Concentrated", "Fragile"]
    cash_posture: Literal["Deployable", "Balanced", "Defensive"]
    concentration_risk: Literal["Low", "Moderate", "High"]
    summary: str
    actions: List[str] = Field(default_factory=list)


class AnalystReports(BaseModel):
    technical: TechnicalAnalysisReport | None = None
    news: NewsAnalysisReport | None = None
    sentiment: SentimentAnalysisReport | None = None
    portfolio_structure: PortfolioStructureReport | None = None


class DebateTurn(BaseModel):
    speaker: str
    stance: Literal["Bullish", "Bearish", "Aggressive", "Neutral", "Conservative", "Manager", "Judge", "Trader"]
    message: str


class InvestmentDebateState(BaseModel):
    history: List[DebateTurn] = Field(default_factory=list)
    bull_case: str = ""
    bear_case: str = ""
    latest_message: str = ""
    latest_speaker: str = ""
    round_count: int = 0
    manager_summary: str = ""


class PortfolioManagerDecision(BaseModel):
    stance: Literal["Accumulate", "Hold", "Reduce Risk", "Rebalance"]
    confidence: int = Field(..., ge=1, le=10)
    summary: str
    reasoning: List[Union[str, SentimentText]] = Field(..., min_length=2)


class TraderProposal(BaseModel):
    action: Literal["Accumulate", "Hold", "Reduce Risk", "Rebalance"]
    confidence: int = Field(..., ge=1, le=10)
    thesis: str
    implementation_steps: List[str] = Field(default_factory=list)


class RiskPerspectiveReport(BaseModel):
    risk_level: Literal["Low", "Moderate", "High", "Critical"]
    preservation_bias: Literal["Bullish", "Neutral", "Defensive"]
    constraints: List[str] = Field(default_factory=list)
    summary: str


class RiskDebateState(BaseModel):
    history: List[DebateTurn] = Field(default_factory=list)
    aggressive_view: str = ""
    neutral_view: str = ""
    conservative_view: str = ""
    latest_message: str = ""
    latest_speaker: str = ""
    round_count: int = 0
    judge_summary: str = ""
    final_risk_level: Literal["Low", "Moderate", "High", "Critical"] = "Moderate"
    capital_preservation_bias: Literal["Bullish", "Neutral", "Defensive"] = "Neutral"
    constraints: List[str] = Field(default_factory=list)


class FinalDecision(BaseModel):
    action: Literal["Accumulate", "Hold", "Reduce Risk", "Rebalance", "Stop Loss"]
    confidence: int = Field(..., ge=1, le=10)
    summary: str
    reasoning: List[Union[str, SentimentText]] = Field(..., min_length=2)
    portfolio_actions: List[str] = Field(default_factory=list)
    decision_source: Literal["manager_consensus", "trader_proposal", "risk_judge", "guardrail_override"]
    overridden_by_guardrail: bool = False


class RiskJudgeDecision(BaseModel):
    risk_level: Literal["Low", "Moderate", "High", "Critical"]
    preservation_bias: Literal["Bullish", "Neutral", "Defensive"]
    constraints: List[str] = Field(default_factory=list)
    action: Literal["Accumulate", "Hold", "Reduce Risk", "Rebalance", "Stop Loss"]
    confidence: int = Field(..., ge=1, le=10)
    summary: str
    reasoning: List[Union[str, SentimentText]] = Field(..., min_length=2)
    portfolio_actions: List[str] = Field(default_factory=list)


class WorkflowTraceEvent(BaseModel):
    step: str
    status: Literal["started", "completed", "skipped", "error"]
    detail: str


class TradingAgentEvaluationResponse(BaseModel):
    status: Literal["success", "error"]
    workflow_version: str = "trading_agent_v1"
    meta: dict | None = None
    final_decision: FinalDecision | None = None
    analyst_reports: AnalystReports | None = None
    investment_debate: InvestmentDebateState | None = None
    portfolio_manager_decision: PortfolioManagerDecision | None = None
    trader_proposal: TraderProposal | None = None
    risk_debate: RiskDebateState | None = None
    trace: List[WorkflowTraceEvent] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    error: str | None = None
