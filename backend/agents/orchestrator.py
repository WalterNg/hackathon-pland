import logging
from langgraph.graph import StateGraph, START, END
from schemas.state import AgentState
from schemas.output import FinalDecision
from agents.ta_agent.agent import analyze_technical
from agents.sentiment_agent.agent import analyze_sentiment
from agents.risk_agent.agent import analyze_risk

logger = logging.getLogger("hackathon-pland")

async def base_orchestrator(state: AgentState) -> AgentState:
    """
    LangGraph node: Receives outputs from agents (TA, Sentiment) and makes a final decision.
    """
    logger.info("Executing Base Orchestrator.")
    
    if state.get("error"):
        logger.warning(f"Orchestrator received error state: {state['error']}")
        return state

    ta_result = state.get("ta_result")
    sentiment_result = state.get("sentiment_result")
    risk_result = state.get("risk_result")

    if not ta_result:
        return {"error": "TA result missing"}
        
    reasoning_parts = []
    
    # 1. TA Reasoning
    reasoning_parts.append(f"TA ({ta_result.trend}): " + "; ".join(ta_result.reasons))
    
    # 2. Sentiment Reasoning
    if sentiment_result:
        reasoning_parts.append(f"Sentiment ({sentiment_result.bias}, Score {sentiment_result.sentiment_score}): {sentiment_result.narrative_summary}")

    # 3. Risk Reasoning
    if risk_result:
        reasoning_parts.append(f"Risk ({risk_result.risk_level}): " + " ".join(risk_result.recommended_constraints))

    # Base Action
    action = ta_result.recommended_action
    
    # Sentiment Adjustment
    if sentiment_result and sentiment_result.bias != ta_result.trend:
        if sentiment_result.bias == "Bearish" and ta_result.trend == "Bullish":
            action = "Hold" # Sentiment overrides weak TA
            reasoning_parts.append("Conflicting signals: TA is Bullish but Sentiment is Bearish. Downgrading to Hold.")

    # Risk Adjustment (Overrides everything)
    if risk_result and risk_result.risk_level in ["High", "Critical"]:
        if action in ["Accumulate", "Take Profit"]:
            action = "Hold" if risk_result.risk_level == "High" else "Stop Loss"
            reasoning_parts.append(f"RISK OVERRIDE: Risk is {risk_result.risk_level}. Halting aggressive actions.")

    final_decision = FinalDecision(
        action=action,
        reasoning=" | ".join(reasoning_parts)
    )
    
    logger.info(f"Orchestrator Final Decision: {final_decision.action}")
    logger.info(f"Reasoning: {final_decision.reasoning}")
    
    return {"final_decision": final_decision}

# Define the graph
def create_graph():
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("ta_agent", analyze_technical)
    workflow.add_node("sentiment_agent", analyze_sentiment)
    workflow.add_node("risk_agent", analyze_risk)
    workflow.add_node("orchestrator", base_orchestrator)
    
    # Add edges
    # Fan out to run concurrently
    workflow.add_edge(START, "ta_agent")
    workflow.add_edge(START, "sentiment_agent")
    workflow.add_edge(START, "risk_agent")
    
    # Fan in to orchestrator
    workflow.add_edge(["ta_agent", "sentiment_agent", "risk_agent"], "orchestrator")
    
    # End
    workflow.add_edge("orchestrator", END)
    
    # Compile
    app = workflow.compile()
    return app

# Graph instance
evaluator_graph = create_graph()
