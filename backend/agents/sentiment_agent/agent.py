import logging
from core.base_agent import BaseAgent, AgentError
from schemas.state import AgentState
from schemas.output import SentimentResult
from .prompts import SENTIMENT_SYSTEM_PROMPT

logger = logging.getLogger("SENTIMENT_AGENT")


class SentimentAgent(BaseAgent):
    """Analyzes news headlines and social dominance metrics."""

    def _build_input(self, state: AgentState) -> str:
        payload = state["payload"]
        headlines_text = "\n".join(f"  - {h}" for h in payload.news_headlines)
        return (
            f"Please analyze the following sentiment indicators:\n"
            f"News Headlines:\n{headlines_text}\n"
            f"Social Dominance: {payload.social_dominance}%"
        )

    async def run_node(self, state: AgentState) -> AgentState:
        logger.info("Executing Sentiment Agent.")
        payload = state["payload"]

        if not payload.news_headlines and not payload.social_dominance:
            logger.info("No sentiment data provided, defaulting to Neutral.")
            return {"sentiment_result": SentimentResult(
                sentiment_score=50,
                narrative_summary="No significant news or social data provided.",
                bias="Neutral",
            )}

        try:
            result: SentimentResult = await self.run(
                SENTIMENT_SYSTEM_PROMPT, self._build_input(state), SentimentResult
            )
            return {"sentiment_result": result}
        except AgentError as e:
            logger.error(str(e))
            return {"error": f"Sentiment Agent failed: {e}"}


# Singleton node function for LangGraph
_agent = SentimentAgent()

async def run_agent(state: AgentState) -> AgentState:
    return await _agent.run_node(state)
