import logging
from core.base_agent import BaseAgent, AgentError
from schemas.state import AgentState
from schemas.output import RiskResult
from .prompts import RISK_SYSTEM_PROMPT

logger = logging.getLogger("RISK_AGENT")


class RiskAgent(BaseAgent):
    """Evaluates portfolio risk level based on market data and portfolio composition."""

    def _build_input(self, state: AgentState) -> str:
        payload = state["payload"]
        portfolio = payload.portfolio
        md = payload.market_data

        total_assets_value = sum(
            item.amount * (item.current_price or 0.0)
            for item in portfolio
        )
        total_value = total_assets_value + payload.stablecoin_reserve

        return (
            f"Please evaluate the risk level for the following context:\n"
            f"  Total Portfolio Value: ${total_value:.2f}\n"
            f"  Stablecoin Reserve: ${payload.stablecoin_reserve:.2f}\n"
            f"  Number of Assets: {len(portfolio)}\n"
            f"Market Data:\n"
            f"  RVOL: {md.rvol}\n"
            f"  MA50: {md.ma50}\n"
            f"  RSI: {md.rsi}"
        )

    async def run_node(self, state: AgentState) -> AgentState:
        logger.info("Executing Risk Agent.")
        try:
            result: RiskResult = await self.run(
                RISK_SYSTEM_PROMPT, self._build_input(state), RiskResult
            )
            return {"risk_result": result}
        except AgentError as e:
            logger.error(str(e))
            return {"error": f"Risk Agent failed: {e}"}


# Singleton node function for LangGraph
_agent = RiskAgent()

async def run_agent(state: AgentState) -> AgentState:
    return await _agent.run_node(state)
