import logging

from core.base_agent import AgentError, BaseAgent
from schemas.output import PortfolioRiskResult
from schemas.state import AgentState

from .prompts import RISK_SYSTEM_PROMPT

logger = logging.getLogger("RISK_AGENT")


class RiskAgent(BaseAgent):
    """Evaluates portfolio-level risk using concentration, cash, and technical risk signals."""

    def _build_input(self, state: AgentState) -> str:
        risk_input = state.get("risk_input")
        if not risk_input:
            raise AgentError("Risk input missing from state - cannot evaluate portfolio risk.")

        positions_text = "\n".join(
            f"  - {position.symbol}: weight={position.weight:.2%}, value=${position.value_usd:.2f}"
            for position in risk_input.positions
        )

        return (
            "Evaluate the following portfolio-level risk snapshot.\n"
            f"Cash Ratio: {risk_input.cash_ratio:.2%}\n"
            f"Positions:\n{positions_text}\n"
            f"Portfolio Metrics: {risk_input.portfolio_metrics.model_dump()}\n"
            f"Technical Risk Signals: {risk_input.technical_risk_signals.model_dump()}\n"
            f"Market Risk Context: {risk_input.market_risk_context.model_dump()}"
        )

    async def run_node(self, state: AgentState) -> AgentState:
        logger.info("Executing Risk Agent.")
        try:
            result: PortfolioRiskResult = await self.run(
                RISK_SYSTEM_PROMPT, self._build_input(state), PortfolioRiskResult
            )
            return {"risk_result": result}
        except AgentError as e:
            logger.error(str(e))
            return {"error": f"Risk Agent failed: {e}"}


_agent = RiskAgent()


async def run_agent(state: AgentState) -> AgentState:
    return await _agent.run_node(state)
