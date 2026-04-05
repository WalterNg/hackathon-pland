from trading_agent.agents.prompts import BEAR_RESEARCHER_PROMPT, BULL_RESEARCHER_PROMPT
from trading_agent.core import ConversationMemory, TradingAgentError, TradingRoleAgent
from trading_agent.schemas.output import DebateTurn, InvestmentDebateState, WorkflowTraceEvent
from trading_agent.schemas.state import TradingAgentState

BEAR_CASE_FALLBACK_MESSAGE = "Bear case unavailable for this run."
BEAR_CASE_FALLBACK_WARNING = "Bear researcher returned an empty case. Using fallback content."


def _debate_state(state: TradingAgentState) -> InvestmentDebateState:
    return state.get("investment_debate") or InvestmentDebateState()


from typing import Any, Union


def _format_item(item: Any) -> str:
    """Formats a Union[str, SentimentText] into a consistent string with sentiment markers."""
    if isinstance(item, str):
        return item
    text = getattr(item, "text", "") or (item.get("text", "") if isinstance(item, dict) else "")
    sent = getattr(item, "sentiment", "") or (
        item.get("sentiment", "Neutral") if isinstance(item, dict) else "Neutral"
    )

    marker = "(--)"
    if sent == "Bullish":
        marker = "(++)"
    elif sent == "Bearish":
        marker = "(!!)"

    return f"{marker} [{sent}] {text}"


def _analyst_brief(state: TradingAgentState) -> str:
    """
    Creates a human-readable, sentiment-aware summary of all analyst reports.
    Robust to reports being either Pydantic models or dictionaries.
    """
    reports = state.get("analyst_reports")
    if not reports:
        return "No analyst reports available."

    sections = []

    # Helper to get field safely from either model or dict
    def get_field(obj, field, default=None):
        if obj is None:
            return default
        return obj.get(field, default) if isinstance(obj, dict) else getattr(obj, field, default)

    # 1. Technical Analysis
    tech = get_field(reports, "technical")
    if tech:
        lines = [
            f"### TECHNICAL ANALYSIS (Bias: {get_field(tech, 'portfolio_trend')}, Strength: {get_field(tech, 'signal_strength')}/10)",
            f"Summary: {get_field(tech, 'summary')}",
            "Evidence:",
        ]
        evidence = get_field(tech, "evidence", [])
        lines.extend([f"- {_format_item(e)}" for e in evidence])
        sections.append("\n".join(lines))

    # 2. News Analysis
    news = get_field(reports, "news")
    if news:
        lines = [
            f"### NEWS ANALYSIS (Bias: {get_field(news, 'market_bias')}, Confidence: {get_field(news, 'confidence')}/10)",
            f"Summary: {get_field(news, 'summary')}",
            "Catalysts & Headwinds:",
        ]
        catalysts = get_field(news, "catalysts", [])
        headwinds = get_field(news, "headwinds", [])
        lines.extend([f"- [Catalyst] {_format_item(c)}" for c in catalysts])
        lines.extend([f"- [Headwind] {_format_item(h)}" for h in headwinds])
        sections.append("\n".join(lines))

    # 3. Sentiment Analysis
    sent = get_field(reports, "sentiment")
    if sent:
        lines = [
            f"### SENTIMENT ANALYSIS (Bias: {get_field(sent, 'sentiment_bias')}, Confidence: {get_field(sent, 'confidence')}/10)",
            f"Summary: {get_field(sent, 'summary')}",
            "Key Drivers:",
        ]
        drivers = get_field(sent, "drivers", [])
        lines.extend([f"- {_format_item(d)}" for d in drivers])
        sections.append("\n".join(lines))

    # 4. Portfolio Structure
    struct = get_field(reports, "portfolio_structure")
    if struct:
        lines = [
            f"### PORTFOLIO STRUCTURE (Risk: {get_field(struct, 'concentration_risk')}, View: {get_field(struct, 'diversification_view')})",
            f"Cash Posture: {get_field(struct, 'cash_posture')}",
            f"Summary: {get_field(struct, 'summary')}",
        ]
        sections.append("\n".join(lines))

    return "\n\n".join(sections)


class BullResearcher(TradingRoleAgent):
    system_prompt = BULL_RESEARCHER_PROMPT
    output_schema = DebateTurn

    def __init__(self, memory: ConversationMemory):
        super().__init__("bull_researcher")
        self.memory = memory

    async def run_node(self, state: TradingAgentState) -> TradingAgentState:
        debate = _debate_state(state)
        memories = "\n".join(self.memory.recall(_analyst_brief(state))) or "No prior lessons."
        user_input = (
            f"Analyst reports:\n{_analyst_brief(state)}\n\n"
            f"Debate history:\n{debate.model_dump_json(indent=2)}\n\n"
            f"Remembered lessons:\n{memories}"
        )
        try:
            turn = await self.run_structured(user_input)
            debate.history.append(turn)
            debate.bull_case = turn.message
            debate.latest_message = turn.message
            debate.latest_speaker = self.name
            debate.round_count += 1
            return {
                "investment_debate": debate,
                "trace": [WorkflowTraceEvent(step="bull_researcher", status="completed", detail="Bull case updated.")],
            }
        except TradingAgentError as exc:
            return {"error": f"bull_researcher failed: {exc}"}


class BearResearcher(TradingRoleAgent):
    system_prompt = BEAR_RESEARCHER_PROMPT
    output_schema = DebateTurn

    def __init__(self, memory: ConversationMemory):
        super().__init__("bear_researcher")
        self.memory = memory

    async def run_node(self, state: TradingAgentState) -> TradingAgentState:
        debate = _debate_state(state)
        memories = "\n".join(self.memory.recall(_analyst_brief(state))) or "No prior lessons."
        user_input = (
            f"Analyst reports:\n{_analyst_brief(state)}\n\n"
            f"Debate history:\n{debate.model_dump_json(indent=2)}\n\n"
            f"Remembered lessons:\n{memories}"
        )
        try:
            turn = await self.run_structured(user_input)
            normalized_message = turn.message.strip()
            used_fallback = not normalized_message
            bear_case_message = normalized_message or BEAR_CASE_FALLBACK_MESSAGE

            # Keep debate history readable for downstream manager synthesis.
            turn.message = bear_case_message
            debate.history.append(turn)
            debate.bear_case = bear_case_message
            debate.latest_message = bear_case_message
            debate.latest_speaker = self.name
            debate.round_count += 1
            return {
                "investment_debate": debate,
                "warnings": [BEAR_CASE_FALLBACK_WARNING] if used_fallback else [],
                "trace": [
                    WorkflowTraceEvent(
                        step="bear_researcher",
                        status="completed",
                        detail="Bear case used fallback content due to empty model output."
                        if used_fallback
                        else "Bear case updated.",
                    )
                ],
            }
        except TradingAgentError as exc:
            return {"error": f"bear_researcher failed: {exc}"}
