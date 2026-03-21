from typing import Annotated, Optional, TypedDict

from .input import GraphMeta, PortfolioNewsMarketInput, PortfolioRiskInput, PortfolioTAInput
from .output import PortfolioDecision, PortfolioNewsMarketResult, PortfolioRiskResult, PortfolioTAResult


def merge_errors(left: Optional[str], right: Optional[str]) -> Optional[str]:
    """Reducer to handle concurrent updates to the error field."""
    if right:
        return right
    return left


class AgentState(TypedDict):
    meta: GraphMeta
    ta_input: Optional[PortfolioTAInput]
    news_market_input: Optional[PortfolioNewsMarketInput]
    risk_input: Optional[PortfolioRiskInput]
    ta_result: Optional[PortfolioTAResult]
    news_market_result: Optional[PortfolioNewsMarketResult]
    risk_result: Optional[PortfolioRiskResult]
    final_decision: Optional[PortfolioDecision]
    error: Annotated[Optional[str], merge_errors]


def create_agent_state(
    *,
    meta: GraphMeta,
    ta_input: Optional[PortfolioTAInput] = None,
    news_market_input: Optional[PortfolioNewsMarketInput] = None,
    risk_input: Optional[PortfolioRiskInput] = None,
) -> AgentState:
    """Create a normalized graph state with per-agent input slices."""

    return {
        "meta": meta,
        "ta_input": ta_input,
        "news_market_input": news_market_input,
        "risk_input": risk_input,
        "ta_result": None,
        "news_market_result": None,
        "risk_result": None,
        "final_decision": None,
        "error": None,
    }
