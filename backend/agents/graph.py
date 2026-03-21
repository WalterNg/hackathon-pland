from langgraph.graph import StateGraph, START, END

from schemas.state import AgentState
from agents.ta_agent.agent import run_agent as run_ta
from agents.sentiment_agent.agent import run_agent as run_sentiment
from agents.risk_agent.agent import run_agent as run_risk
from agents.synthesis_agent.agent import run_agent as run_synthesis


def validate_specialist_inputs(state: AgentState) -> AgentState:
    """Fail fast if the evaluator graph is missing required specialist inputs."""
    missing = []

    if state.get("meta") is None:
        missing.append("meta")
    if state.get("ta_input") is None:
        missing.append("ta_input")
    if state.get("news_market_input") is None:
        missing.append("news_market_input")
    if state.get("risk_input") is None:
        missing.append("risk_input")

    if missing:
        return {"error": f"Evaluator graph missing required inputs: {', '.join(missing)}"}
    return {}


def route_after_validation(state: AgentState) -> str:
    if state.get("error"):
        return "end"
    return "dispatch"


def dispatch_specialists(_: AgentState) -> AgentState:
    """No-op node used to make the graph fan-out explicit after validation."""
    return {}


def create_graph():
    workflow = StateGraph(AgentState)

    # Nodes
    workflow.add_node("validate_inputs", validate_specialist_inputs)
    workflow.add_node("dispatch_specialists", dispatch_specialists)
    workflow.add_node("ta_agent", run_ta)
    workflow.add_node("news_market_agent", run_sentiment)
    workflow.add_node("risk_agent", run_risk)
    workflow.add_node("synthesis_agent", run_synthesis)

    # Validate the sliced inputs before specialist fan-out
    workflow.add_edge(START, "validate_inputs")
    workflow.add_conditional_edges(
        "validate_inputs",
        route_after_validation,
        {
            "dispatch": "dispatch_specialists",
            "end": END,
        },
    )

    # Fan-out: all specialist agents run in parallel on their own input slice
    workflow.add_edge("dispatch_specialists", "ta_agent")
    workflow.add_edge("dispatch_specialists", "news_market_agent")
    workflow.add_edge("dispatch_specialists", "risk_agent")

    # Fan-in: synthesis agent waits for all three
    workflow.add_edge(["ta_agent", "news_market_agent", "risk_agent"], "synthesis_agent")

    # End
    workflow.add_edge("synthesis_agent", END)

    return workflow.compile()


# Exported graph instance used by API routes
evaluator_graph = create_graph()
