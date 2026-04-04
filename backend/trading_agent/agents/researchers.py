from trading_agent.agents.prompts import BEAR_RESEARCHER_PROMPT, BULL_RESEARCHER_PROMPT
from trading_agent.core import ConversationMemory, TradingAgentError, TradingRoleAgent
from trading_agent.schemas.output import DebateTurn, InvestmentDebateState, WorkflowTraceEvent
from trading_agent.schemas.state import TradingAgentState


def _debate_state(state: TradingAgentState) -> InvestmentDebateState:
    return state.get("investment_debate") or InvestmentDebateState()


def _analyst_brief(state: TradingAgentState) -> str:
    reports = state.get("analyst_reports")
    return reports.model_dump_json(indent=2) if reports else "{}"


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
            debate.latest_speaker = turn.speaker
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
            debate.history.append(turn)
            debate.bear_case = turn.message
            debate.latest_message = turn.message
            debate.latest_speaker = turn.speaker
            debate.round_count += 1
            return {
                "investment_debate": debate,
                "trace": [WorkflowTraceEvent(step="bear_researcher", status="completed", detail="Bear case updated.")],
            }
        except TradingAgentError as exc:
            return {"error": f"bear_researcher failed: {exc}"}

