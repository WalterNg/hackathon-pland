import logging
from core.base_agent import BaseAgent, AgentError
from schemas.state import AgentState
from schemas.output import TAResult
from .prompts import TA_SYSTEM_PROMPT

logger = logging.getLogger("TA_AGENT")


class TAAgent(BaseAgent):
    """Analyzes technical indicators (RVOL, MA50, RSI, Bollinger Bands, OBV)."""

    def _build_input(self, state: AgentState) -> str:
        md = state["payload"].market_data
        return (
            f"Please analyze the following technical indicators:\n"
            f"  RVOL: {md.rvol}\n"
            f"  MA50: {md.ma50}\n"
            f"  RSI: {md.rsi}\n"
            f"  Bollinger Bands: {md.bollinger_bands}\n"
            f"  OBV: {md.obv}"
        )

    async def run_node(self, state: AgentState) -> AgentState:
        logger.info("Executing TA Agent.")
        try:
            result: TAResult = await self.run(TA_SYSTEM_PROMPT, self._build_input(state), TAResult)
            return {"ta_result": result}
        except AgentError as e:
            logger.error(str(e))
            return {"error": f"TA Agent failed: {e}"}


# Singleton node function for LangGraph
_agent = TAAgent()

async def analyze_technical(state: AgentState) -> AgentState:
    return await _agent.run_node(state)
