from trading_agent.agents.prompts import (
    NEWS_ANALYST_PROMPT,
    PORTFOLIO_STRUCTURE_PROMPT,
    SENTIMENT_ANALYST_PROMPT,
    TECHNICAL_ANALYST_PROMPT,
)
from trading_agent.core import TradingAgentError, TradingRoleAgent
from trading_agent.schemas.output import (
    AnalystReports,
    NewsAnalysisReport,
    PortfolioStructureReport,
    SentimentAnalysisReport,
    TechnicalAnalysisReport,
    WorkflowTraceEvent,
)
from trading_agent.schemas.state import TradingAgentState


def _ensure_reports(state: TradingAgentState) -> AnalystReports:
    return state.get("analyst_reports") or AnalystReports()


class TechnicalAnalyst(TradingRoleAgent):
    system_prompt = TECHNICAL_ANALYST_PROMPT
    output_schema = TechnicalAnalysisReport

    def __init__(self):
        super().__init__("technical_analyst")

    async def run_node(self, state: TradingAgentState) -> TradingAgentState:
        context = state.get("prepared_context")
        if not context:
            return {"error": "technical_analyst missing prepared_context"}
        user_input = context.technical.model_dump_json(indent=2)
        try:
            report = await self.run_structured(user_input)
            reports = _ensure_reports(state)
            reports.technical = report
            return {
                "analyst_reports": reports,
                "trace": [WorkflowTraceEvent(step="technical_analyst", status="completed", detail="Generated technical report.")],
            }
        except TradingAgentError as exc:
            return {"error": f"technical_analyst failed: {exc}"}


class NewsAnalyst(TradingRoleAgent):
    system_prompt = NEWS_ANALYST_PROMPT
    output_schema = NewsAnalysisReport

    def __init__(self):
        super().__init__("news_analyst")

    async def run_node(self, state: TradingAgentState) -> TradingAgentState:
        context = state.get("prepared_context")
        if not context:
            return {"error": "news_analyst missing prepared_context"}
        user_input = context.news.model_dump_json(indent=2)
        try:
            report = await self.run_structured(user_input)
            reports = _ensure_reports(state)
            reports.news = report
            return {
                "analyst_reports": reports,
                "trace": [WorkflowTraceEvent(step="news_analyst", status="completed", detail="Generated news report.")],
            }
        except TradingAgentError as exc:
            return {"error": f"news_analyst failed: {exc}"}


class SentimentAnalyst(TradingRoleAgent):
    system_prompt = SENTIMENT_ANALYST_PROMPT
    output_schema = SentimentAnalysisReport

    def __init__(self):
        super().__init__("sentiment_analyst")

    async def run_node(self, state: TradingAgentState) -> TradingAgentState:
        context = state.get("prepared_context")
        if not context:
            return {"error": "sentiment_analyst missing prepared_context"}
        user_input = context.sentiment.model_dump_json(indent=2)
        try:
            report = await self.run_structured(user_input)
            reports = _ensure_reports(state)
            reports.sentiment = report
            return {
                "analyst_reports": reports,
                "trace": [WorkflowTraceEvent(step="sentiment_analyst", status="completed", detail="Generated sentiment report.")],
            }
        except TradingAgentError as exc:
            return {"error": f"sentiment_analyst failed: {exc}"}


class PortfolioStructureAnalyst(TradingRoleAgent):
    system_prompt = PORTFOLIO_STRUCTURE_PROMPT
    output_schema = PortfolioStructureReport

    def __init__(self):
        super().__init__("portfolio_structure_analyst")

    async def run_node(self, state: TradingAgentState) -> TradingAgentState:
        context = state.get("prepared_context")
        if not context:
            return {"error": "portfolio_structure_analyst missing prepared_context"}
        user_input = context.structure.model_dump_json(indent=2)
        try:
            report = await self.run_structured(user_input)
            reports = _ensure_reports(state)
            reports.portfolio_structure = report
            return {
                "analyst_reports": reports,
                "trace": [WorkflowTraceEvent(step="portfolio_structure_analyst", status="completed", detail="Generated portfolio structure report.")],
            }
        except TradingAgentError as exc:
            return {"error": f"portfolio_structure_analyst failed: {exc}"}

