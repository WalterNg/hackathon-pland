from langgraph.graph import StateGraph, START, END

from schemas.state import AgentState
from agents.ta_agent.agent import run_agent as run_ta
from agents.sentiment_agent.agent import run_agent as run_sentiment
from agents.risk_agent.agent import run_agent as run_risk
from agents.synthesis_agent.agent import run_agent as run_synthesis


def create_graph():
    workflow = StateGraph(AgentState)

    # Nodes
    workflow.add_node("ta_agent", run_ta)
    workflow.add_node("sentiment_agent", run_sentiment)
    workflow.add_node("risk_agent", run_risk)
    workflow.add_node("synthesis_agent", run_synthesis)

    # Fan-out: all specialist agents run in parallel
    workflow.add_edge(START, "ta_agent")
    workflow.add_edge(START, "sentiment_agent")
    workflow.add_edge(START, "risk_agent")

    # Fan-in: synthesis agent waits for all three
    workflow.add_edge(["ta_agent", "sentiment_agent", "risk_agent"], "synthesis_agent")

    # End
    workflow.add_edge("synthesis_agent", END)

    return workflow.compile()


# Exported graph instance used by API routes
evaluator_graph = create_graph()
