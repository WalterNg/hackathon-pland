from trading_agent.agents.prompts import TRADER_PROMPT
from trading_agent.core import ConversationMemory, TradingAgentError, TradingRoleAgent
from trading_agent.schemas.output import TraderProposal, WorkflowTraceEvent
from trading_agent.schemas.state import TradingAgentState


class TraderAgent(TradingRoleAgent):
    system_prompt = TRADER_PROMPT
    output_schema = TraderProposal

    def __init__(self, memory: ConversationMemory):
        super().__init__("trader")
        self.memory = memory

    async def run_node(self, state: TradingAgentState) -> TradingAgentState:
        decision = state.get("portfolio_manager_decision")
        reports = state.get("analyst_reports")
        recalled = "\n".join(self.memory.recall(reports.model_dump_json() if reports else "")) or "No prior trader lessons."
        payload = {
            "portfolio_manager_decision": decision.model_dump() if decision else None,
            "analyst_reports": reports.model_dump() if reports else None,
            "recalled_lessons": recalled,
        }
        try:
            proposal = await self.run_structured(str(payload))
            return {
                "trader_proposal": proposal,
                "trace": [WorkflowTraceEvent(step="trader", status="completed", detail="Trader proposal prepared.")],
            }
        except TradingAgentError as exc:
            return {"error": f"trader failed: {exc}"}

