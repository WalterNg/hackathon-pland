import logging

from core.base_agent import AgentError, BaseAgent
from schemas.output import PortfolioNewsMarketResult
from schemas.state import AgentState

from .prompts import SENTIMENT_SYSTEM_PROMPT

logger = logging.getLogger("SENTIMENT_AGENT")


class SentimentAgent(BaseAgent):
    """Analyzes portfolio-level news and market sentiment."""

    def _build_input(self, state: AgentState) -> str:
        news_input = state.get("news_market_input")
        if not news_input:
            raise AgentError("News or market input missing from state - cannot analyze market context.")

        headlines_text = "\n".join(f"  - {headline}" for headline in news_input.news_headlines) or "  - No headlines provided"
        return (
            "Analyze the following portfolio-level market context.\n"
            f"Portfolio Symbols: {', '.join(news_input.portfolio_symbols)}\n"
            f"Social Sentiment Score: {news_input.social_sentiment_score}\n"
            f"Dominant Narrative: {news_input.dominant_narrative}\n"
            f"Macro Context: {news_input.macro_context}\n"
            f"Headlines:\n{headlines_text}"
        )

    async def run_node(self, state: AgentState) -> AgentState:
        logger.info("Executing Sentiment Agent.")
        news_input = state.get("news_market_input")
        if not news_input:
            return {"error": "News Market Agent failed: news_market_input is missing."}

        if not news_input.news_headlines and not news_input.social_sentiment_score:
            logger.info("No market sentiment data provided, defaulting to Neutral.")
            return {
                "news_market_result": PortfolioNewsMarketResult(
                    market_bias="Neutral",
                    confidence=4,
                    key_catalysts=[],
                    portfolio_headwinds=["No meaningful news or social catalyst was provided."],
                    narrative_summary="Market context is neutral due to limited external information.",
                )
            }

        try:
            result: PortfolioNewsMarketResult = await self.run(
                SENTIMENT_SYSTEM_PROMPT, self._build_input(state), PortfolioNewsMarketResult
            )
            return {"news_market_result": result}
        except AgentError as e:
            logger.error(str(e))
            return {"error": f"News Market Agent failed: {e}"}


_agent = SentimentAgent()


async def run_agent(state: AgentState) -> AgentState:
    return await _agent.run_node(state)
