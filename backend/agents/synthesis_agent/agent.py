import logging

from core.base_agent import AgentError, BaseAgent
from core.guardrails import DEFAULT_GUARDRAILS
from schemas.output import PortfolioDecision
from schemas.state import AgentState

from .prompts import SYNTHESIS_SYSTEM_PROMPT

logger = logging.getLogger("SYNTHESIS_AGENT")


class SynthesisAgent(BaseAgent):
    """Synthesizes portfolio-level TA, news, and risk reports into a final decision."""

    TEMPERATURE = 0.3

    def _build_briefing(self, state: AgentState) -> str:
        meta = state["meta"]
        ta = state.get("ta_result")
        news = state.get("news_market_result")
        risk = state.get("risk_result")

        ta_report = (
            f"Technical Analysis Report:\n"
            f"  Portfolio Trend: {ta.portfolio_trend}\n"
            f"  Signal Strength: {ta.signal_strength}/10\n"
            f"  Strongest Positions: {', '.join(ta.strongest_positions) or 'None'}\n"
            f"  Weakest Positions: {', '.join(ta.weakest_positions) or 'None'}\n"
            f"  Recommendation: {ta.recommended_action}\n"
            f"  Reasons: {'; '.join(ta.reasons)}"
        )

        news_report = (
            f"News and Market Report:\n"
            f"  Bias: {news.market_bias}\n"
            f"  Confidence: {news.confidence}/10\n"
            f"  Catalysts: {'; '.join(news.key_catalysts) or 'None'}\n"
            f"  Headwinds: {'; '.join(news.portfolio_headwinds) or 'None'}\n"
            f"  Summary: {news.narrative_summary}"
        ) if news else "News and Market Report: No data available."

        risk_report = (
            f"Risk Report:\n"
            f"  Level: {risk.risk_level}\n"
            f"  Alerts: {'; '.join(risk.risk_alerts) or 'None'}\n"
            f"  Constraints: {'; '.join(risk.recommended_constraints) or 'None'}\n"
            f"  Preservation Bias: {risk.capital_preservation_bias}"
        ) if risk else "Risk Report: No data available."

        return (
            f"Portfolio Meta:\n"
            f"  Portfolio ID: {meta.portfolio_id}\n"
            f"  As Of: {meta.as_of}\n"
            f"  Symbols: {', '.join(meta.symbols)}\n\n"
            f"{ta_report}\n\n{news_report}\n\n{risk_report}"
        )

    async def run_node(self, state: AgentState) -> AgentState:
        logger.info("Synthesis Agent is reviewing agent reports...")

        if state.get("error"):
            logger.warning("Received error state: %s", state["error"])
            return state

        ta_result = state.get("ta_result")
        if not ta_result:
            return {"error": "TA result missing - cannot synthesize."}

        briefing = self._build_briefing(state)

        try:
            raw_decision: PortfolioDecision = await self.run(
                SYNTHESIS_SYSTEM_PROMPT, briefing, PortfolioDecision
            )
        except AgentError as e:
            logger.error("Synthesis failed: %s. Falling back to TA recommendation.", e)
            raw_decision = PortfolioDecision(
                action="Reduce Risk" if ta_result.recommended_action == "Reduce Risk" else ta_result.recommended_action,
                confidence=max(4, ta_result.signal_strength - 1),
                summary="AI synthesis was unavailable, so the system defaulted to the portfolio technical view.",
                reasoning=ta_result.reasons[:2],
                portfolio_actions=[
                    f"Align portfolio posture with TA recommendation: {ta_result.recommended_action}",
                ],
            )

        final_decision = DEFAULT_GUARDRAILS.apply(raw_decision, state)

        logger.info("Final Decision: %s", final_decision.action)
        logger.info("Summary: %s", final_decision.summary)

        return {"final_decision": final_decision}


_agent = SynthesisAgent()


async def run_agent(state: AgentState) -> AgentState:
    return await _agent.run_node(state)
