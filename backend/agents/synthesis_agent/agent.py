import logging
from core.base_agent import BaseAgent, AgentError
from core.guardrails import DEFAULT_GUARDRAILS
from schemas.state import AgentState
from schemas.output import FinalDecision
from .prompts import SYNTHESIS_SYSTEM_PROMPT

logger = logging.getLogger("SYNTHESIS_AGENT")


class SynthesisAgent(BaseAgent):
    """
    Chief Investment Advisor Agent.
    Synthesizes reports from TA, Sentiment, and Risk agents into a final decision.
    Applies the GuardrailLayer after AI synthesis for safety enforcement.
    """

    TEMPERATURE = 0.3  # Slightly creative for nuanced synthesis

    def _build_briefing(self, state: AgentState) -> str:
        ta = state.get("ta_result")
        sentiment = state.get("sentiment_result")
        risk = state.get("risk_result")

        ta_report = (
            f"Technical Analysis Report:\n"
            f"  Trend: {ta.trend} | Strength: {ta.signal_strength}/10\n"
            f"  Recommendation: {ta.recommended_action}\n"
            f"  Signals: {'; '.join(ta.reasons)}"
        )

        sentiment_report = "Sentiment Report: No data available."
        if sentiment:
            sentiment_report = (
                f"Sentiment Report:\n"
                f"  Bias: {sentiment.bias} | Score: {sentiment.sentiment_score}/100\n"
                f"  Summary: {sentiment.narrative_summary}"
            )

        risk_report = "Risk Report: No data available."
        if risk:
            risk_report = (
                f"Risk Report:\n"
                f"  Level: {risk.risk_level}\n"
                f"  Constraints: {'; '.join(risk.recommended_constraints)}"
            )

        return f"{ta_report}\n\n{sentiment_report}\n\n{risk_report}"

    async def run_node(self, state: AgentState) -> AgentState:
        logger.info("Synthesis Agent is reviewing agent reports...")

        if state.get("error"):
            logger.warning(f"Received error state: {state['error']}")
            return state

        ta_result = state.get("ta_result")
        if not ta_result:
            return {"error": "TA result missing — cannot synthesize."}

        briefing = self._build_briefing(state)

        try:
            raw_decision: FinalDecision = await self.run(
                SYNTHESIS_SYSTEM_PROMPT, briefing, FinalDecision
            )
        except AgentError as e:
            logger.error(f"Synthesis failed: {e}. Falling back to TA recommendation.")
            raw_decision = FinalDecision(
                action=ta_result.recommended_action,
                reasoning=(
                    f"AI synthesis unavailable. Defaulting to TA signal: "
                    f"{ta_result.trend}. {'; '.join(ta_result.reasons)}"
                ),
            )

        # Apply safety guardrails after AI decision
        final_decision = DEFAULT_GUARDRAILS.apply(raw_decision, state)

        logger.info(f"Final Decision: {final_decision.action}")
        logger.info(f"Reasoning: {final_decision.reasoning}")

        return {"final_decision": final_decision}


# Singleton node function for LangGraph
_agent = SynthesisAgent()

async def run_agent(state: AgentState) -> AgentState:
    return await _agent.run_node(state)
