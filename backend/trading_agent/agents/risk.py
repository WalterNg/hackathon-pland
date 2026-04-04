from trading_agent.agents.prompts import (
    AGGRESSIVE_RISK_PROMPT,
    CONSERVATIVE_RISK_PROMPT,
    NEUTRAL_RISK_PROMPT,
)
from trading_agent.core import TradingAgentError, TradingRoleAgent
from trading_agent.schemas.output import DebateTurn, RiskDebateState, WorkflowTraceEvent
from trading_agent.schemas.state import TradingAgentState


def _risk_state(state: TradingAgentState) -> RiskDebateState:
    return state.get("risk_debate") or RiskDebateState()


def _risk_payload(state: TradingAgentState) -> str:
    trader_proposal = state.get("trader_proposal")
    reports = state.get("analyst_reports")
    debate = _risk_state(state)
    payload = {
        "trader_proposal": trader_proposal.model_dump() if trader_proposal else None,
        "analyst_reports": reports.model_dump() if reports else None,
        "risk_debate": debate.model_dump(),
    }
    return str(payload)


class AggressiveRiskAnalyst(TradingRoleAgent):
    system_prompt = AGGRESSIVE_RISK_PROMPT
    output_schema = DebateTurn

    def __init__(self):
        super().__init__("aggressive_risk_analyst")

    async def run_node(self, state: TradingAgentState) -> TradingAgentState:
        debate = _risk_state(state)
        try:
            turn = await self.run_structured(_risk_payload(state))
            debate.history.append(turn)
            debate.aggressive_view = turn.message
            debate.latest_message = turn.message
            debate.latest_speaker = turn.speaker
            debate.round_count += 1
            return {
                "risk_debate": debate,
                "trace": [WorkflowTraceEvent(step="aggressive_risk_analyst", status="completed", detail="Aggressive risk stance updated.")],
            }
        except TradingAgentError as exc:
            return {"error": f"aggressive_risk_analyst failed: {exc}"}


class ConservativeRiskAnalyst(TradingRoleAgent):
    system_prompt = CONSERVATIVE_RISK_PROMPT
    output_schema = DebateTurn

    def __init__(self):
        super().__init__("conservative_risk_analyst")

    async def run_node(self, state: TradingAgentState) -> TradingAgentState:
        debate = _risk_state(state)
        try:
            turn = await self.run_structured(_risk_payload(state))
            debate.history.append(turn)
            debate.conservative_view = turn.message
            debate.latest_message = turn.message
            debate.latest_speaker = turn.speaker
            debate.round_count += 1
            return {
                "risk_debate": debate,
                "trace": [WorkflowTraceEvent(step="conservative_risk_analyst", status="completed", detail="Conservative risk stance updated.")],
            }
        except TradingAgentError as exc:
            return {"error": f"conservative_risk_analyst failed: {exc}"}


class NeutralRiskAnalyst(TradingRoleAgent):
    system_prompt = NEUTRAL_RISK_PROMPT
    output_schema = DebateTurn

    def __init__(self):
        super().__init__("neutral_risk_analyst")

    async def run_node(self, state: TradingAgentState) -> TradingAgentState:
        debate = _risk_state(state)
        try:
            turn = await self.run_structured(_risk_payload(state))
            debate.history.append(turn)
            debate.neutral_view = turn.message
            debate.latest_message = turn.message
            debate.latest_speaker = turn.speaker
            debate.round_count += 1
            return {
                "risk_debate": debate,
                "trace": [WorkflowTraceEvent(step="neutral_risk_analyst", status="completed", detail="Neutral risk stance updated.")],
            }
        except TradingAgentError as exc:
            return {"error": f"neutral_risk_analyst failed: {exc}"}

