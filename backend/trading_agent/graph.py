from langgraph.graph import END, START, StateGraph

from trading_agent.agents import (
    AggressiveRiskAnalyst,
    BearResearcher,
    BullResearcher,
    ConservativeRiskAnalyst,
    InvestmentManager,
    NeutralRiskAnalyst,
    NewsAnalyst,
    PortfolioStructureAnalyst,
    RiskJudge,
    SentimentAnalyst,
    TechnicalAnalyst,
    TraderAgent,
)
from trading_agent.config import DEFAULT_TRADING_AGENT_CONFIG
from trading_agent.core import ConversationMemory, DEFAULT_TRADING_GUARDRAILS
from trading_agent.dataflows import build_trading_context
from trading_agent.schemas.output import WorkflowTraceEvent
from trading_agent.schemas.state import TradingAgentState


def validate_inputs(state: TradingAgentState) -> TradingAgentState:
    """
    Validates the initial input for the trading agent workflow.

    Checks if the request payload exists and if the portfolio contains at least one asset.
    Returns a state with an error message if validation fails, or a trace event if successful.
    """
    request = state.get("request")
    if request is None:
        return {"error": "trading_agent request payload is missing"}
    if not request.portfolio and request.stablecoin_reserve <= 0:
        return {"error": "trading_agent request must contain at least one asset or stablecoin reserve"}
    return {"trace": [WorkflowTraceEvent(step="validate_inputs", status="completed", detail="Request validated.")]}


def route_after_validation(state: TradingAgentState) -> str:
    """
    Routes the workflow after the validation step.

    Returns "end" if there is an error in the state, otherwise proceeds to "prepare_context".
    """
    if state.get("error"):
        return "end"
    return "prepare_context"


async def prepare_context(state: TradingAgentState) -> TradingAgentState:
    """
    Asynchronously builds the trading context for the agent.

    Fetches market data, technical indicators, and news based on the request assets.
    Updates the state with meta information, prepared context, and any warnings.
    """
    meta, context, warnings = await build_trading_context(state["request"])
    return {
        "meta": meta,
        "prepared_context": context,
        "warnings": warnings,
        "trace": [WorkflowTraceEvent(step="prepare_context", status="completed", detail="Prepared local portfolio context.")],
    }


def should_continue_investment_debate(state: TradingAgentState) -> str:
    """
    Determines the next step in the investment debate between researchers.

    Cycles between Bull and Bear researchers for a configured number of rounds.
    Ends the debate by routing to the investment_manager once the round limit is reached.
    """
    debate = state.get("investment_debate")
    if not debate:
        return "investment_manager"
    if debate.round_count >= 2 * DEFAULT_TRADING_AGENT_CONFIG.investment_debate_rounds:
        return "investment_manager"
    if debate.latest_speaker == "Bull Researcher":
        return "bear_researcher"
    return "bull_researcher"


def should_continue_risk_debate(state: TradingAgentState) -> str:
    """
    Determines the next step in the risk analysis debate.

    Cycles between Aggressive, Conservative, and Neutral analysts for a configured number of rounds.
    Routes to the risk_judge to finalize the risk assessment after the debate completes.
    """
    debate = state.get("risk_debate")
    if not debate:
        return "risk_judge"
    if debate.round_count >= 3 * DEFAULT_TRADING_AGENT_CONFIG.risk_debate_rounds:
        return "risk_judge"
    if debate.latest_speaker == "Aggressive Risk Analyst":
        return "conservative_risk_analyst"
    if debate.latest_speaker == "Conservative Risk Analyst":
        return "neutral_risk_analyst"
    return "aggressive_risk_analyst"


def apply_guardrails(state: TradingAgentState) -> TradingAgentState:
    """
    Applies safety guardrails to the final trading decision.

    Ensures the proposed trade adheres to volume limits, risk thresholds, and other constraints.
    Returns the state with the modified final decision.
    """
    final_decision = state.get("final_decision")
    if not final_decision:
        return {"error": "guardrail phase missing final decision"}
    return {
        "final_decision": DEFAULT_TRADING_GUARDRAILS.apply(final_decision, state),
        "trace": [WorkflowTraceEvent(step="guardrails", status="completed", detail="Applied final guardrails.")],
    }


def finalize_response(_: TradingAgentState) -> TradingAgentState:
    """
    Finalizes the workflow execution.

    Internal cleanup and assembly of the final trace event for the response.
    """
    return {"trace": [WorkflowTraceEvent(step="finalize_response", status="completed", detail="Final state assembled for response.")]}


def create_trading_agent_graph():
    """
    Constructs and compiles the complete LangGraph workflow for the trading agent.

    Defines all nodes (agents and logic), edges (sequential flows), and conditional
    edges (debate loops and routing logic). Returns a compiled graph ready for execution.
    """
    bull_memory = ConversationMemory("bull_researcher")
    bear_memory = ConversationMemory("bear_researcher")
    trader_memory = ConversationMemory("trader")

    technical_analyst = TechnicalAnalyst()
    news_analyst = NewsAnalyst()
    sentiment_analyst = SentimentAnalyst()
    portfolio_structure_analyst = PortfolioStructureAnalyst()
    bull_researcher = BullResearcher(memory=bull_memory)
    bear_researcher = BearResearcher(memory=bear_memory)
    investment_manager = InvestmentManager()
    trader = TraderAgent(memory=trader_memory)
    aggressive_risk = AggressiveRiskAnalyst()
    conservative_risk = ConservativeRiskAnalyst()
    neutral_risk = NeutralRiskAnalyst()
    risk_judge = RiskJudge()

    workflow = StateGraph(TradingAgentState)
    workflow.add_node("validate_inputs", validate_inputs)
    workflow.add_node("prepare_context", prepare_context)
    workflow.add_node("technical_analyst", technical_analyst.run_node)
    workflow.add_node("news_analyst", news_analyst.run_node)
    workflow.add_node("sentiment_analyst", sentiment_analyst.run_node)
    workflow.add_node("portfolio_structure_analyst", portfolio_structure_analyst.run_node)
    workflow.add_node("bull_researcher", bull_researcher.run_node)
    workflow.add_node("bear_researcher", bear_researcher.run_node)
    workflow.add_node("investment_manager", investment_manager.run_node)
    workflow.add_node("trader", trader.run_node)
    workflow.add_node("aggressive_risk_analyst", aggressive_risk.run_node)
    workflow.add_node("conservative_risk_analyst", conservative_risk.run_node)
    workflow.add_node("neutral_risk_analyst", neutral_risk.run_node)
    workflow.add_node("risk_judge", risk_judge.run_node)
    workflow.add_node("guardrails", apply_guardrails)
    workflow.add_node("finalize_response", finalize_response)

    workflow.add_edge(START, "validate_inputs")
    workflow.add_conditional_edges(
        "validate_inputs",
        route_after_validation,
        {
            "prepare_context": "prepare_context",
            "end": END,
        },
    )
    workflow.add_edge("prepare_context", "technical_analyst")
    workflow.add_edge("technical_analyst", "news_analyst")
    workflow.add_edge("news_analyst", "sentiment_analyst")
    workflow.add_edge("sentiment_analyst", "portfolio_structure_analyst")
    workflow.add_edge("portfolio_structure_analyst", "bull_researcher")
    workflow.add_conditional_edges(
        "bull_researcher",
        should_continue_investment_debate,
        {
            "bear_researcher": "bear_researcher",
            "investment_manager": "investment_manager",
            "bull_researcher": "bull_researcher",
        },
    )
    workflow.add_conditional_edges(
        "bear_researcher",
        should_continue_investment_debate,
        {
            "bull_researcher": "bull_researcher",
            "investment_manager": "investment_manager",
            "bear_researcher": "bear_researcher",
        },
    )
    workflow.add_edge("investment_manager", "trader")
    workflow.add_edge("trader", "aggressive_risk_analyst")
    workflow.add_conditional_edges(
        "aggressive_risk_analyst",
        should_continue_risk_debate,
        {
            "conservative_risk_analyst": "conservative_risk_analyst",
            "risk_judge": "risk_judge",
            "aggressive_risk_analyst": "aggressive_risk_analyst",
        },
    )
    workflow.add_conditional_edges(
        "conservative_risk_analyst",
        should_continue_risk_debate,
        {
            "neutral_risk_analyst": "neutral_risk_analyst",
            "risk_judge": "risk_judge",
            "aggressive_risk_analyst": "aggressive_risk_analyst",
        },
    )
    workflow.add_conditional_edges(
        "neutral_risk_analyst",
        should_continue_risk_debate,
        {
            "aggressive_risk_analyst": "aggressive_risk_analyst",
            "risk_judge": "risk_judge",
            "neutral_risk_analyst": "neutral_risk_analyst",
        },
    )
    workflow.add_edge("risk_judge", "guardrails")
    workflow.add_edge("guardrails", "finalize_response")
    workflow.add_edge("finalize_response", END)

    return workflow.compile()


trading_agent_graph = create_trading_agent_graph()
