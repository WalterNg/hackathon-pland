from typing import Annotated, Optional, TypedDict

from trading_agent.schemas.input import PortfolioContext, TradingAgentMeta, TradingAgentRequest
from trading_agent.schemas.output import (
    AnalystReports,
    FinalDecision,
    InvestmentDebateState,
    PortfolioManagerDecision,
    RiskDebateState,
    TraderProposal,
    WorkflowTraceEvent,
)


def merge_errors(left: Optional[str], right: Optional[str]) -> Optional[str]:
    if right:
        return right
    return left


def merge_warnings(left: list[str], right: list[str]) -> list[str]:
    return [*left, *right]


def merge_trace(left: list[WorkflowTraceEvent], right: list[WorkflowTraceEvent]) -> list[WorkflowTraceEvent]:
    return [*left, *right]


class TradingAgentState(TypedDict):
    request: TradingAgentRequest
    meta: Optional[TradingAgentMeta]
    prepared_context: Optional[PortfolioContext]
    analyst_reports: Optional[AnalystReports]
    investment_debate: Optional[InvestmentDebateState]
    portfolio_manager_decision: Optional[PortfolioManagerDecision]
    trader_proposal: Optional[TraderProposal]
    risk_debate: Optional[RiskDebateState]
    final_decision: Optional[FinalDecision]
    trace: Annotated[list[WorkflowTraceEvent], merge_trace]
    warnings: Annotated[list[str], merge_warnings]
    error: Annotated[Optional[str], merge_errors]


def create_trading_agent_state(request: TradingAgentRequest) -> TradingAgentState:
    return {
        "request": request,
        "meta": None,
        "prepared_context": None,
        "analyst_reports": None,
        "investment_debate": None,
        "portfolio_manager_decision": None,
        "trader_proposal": None,
        "risk_debate": None,
        "final_decision": None,
        "trace": [],
        "warnings": [],
        "error": None,
    }

