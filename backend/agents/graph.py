from langgraph.graph import StateGraph, START, END

from schemas.state import AgentState
from agents.ta_agent.agent import analyze_technical
from agents.sentiment_agent.agent import analyze_sentiment
from agents.risk_agent.agent import analyze_risk
from agents.synthesis_agent.agent import synthesize


def create_graph():
    workflow = StateGraph(AgentState)

    # Nodes
    workflow.add_node("ta_agent", analyze_technical)
    workflow.add_node("sentiment_agent", analyze_sentiment)
    workflow.add_node("risk_agent", analyze_risk)
    workflow.add_node("synthesis_agent", synthesize)

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
