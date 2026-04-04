from trading_agent.agents.prompts import INVESTMENT_MANAGER_PROMPT, RISK_JUDGE_PROMPT
from trading_agent.core import TradingAgentError, TradingRoleAgent
from trading_agent.schemas.output import (
    FinalDecision,
    InvestmentDebateState,
    PortfolioManagerDecision,
    RiskDebateState,
    RiskJudgeDecision,
    WorkflowTraceEvent,
)
from trading_agent.schemas.state import TradingAgentState


class InvestmentManager(TradingRoleAgent):
    system_prompt = INVESTMENT_MANAGER_PROMPT
    output_schema = PortfolioManagerDecision

    def __init__(self):
        super().__init__("investment_manager")

    async def run_node(self, state: TradingAgentState) -> TradingAgentState:
        debate = state.get("investment_debate") or InvestmentDebateState()
        user_input = debate.model_dump_json(indent=2)
        try:
            decision = await self.run_structured(user_input)
            debate.manager_summary = decision.summary
            return {
                "investment_debate": debate,
                "portfolio_manager_decision": decision,
                "trace": [WorkflowTraceEvent(step="investment_manager", status="completed", detail="Manager selected portfolio stance.")],
            }
        except TradingAgentError as exc:
            return {"error": f"investment_manager failed: {exc}"}


class RiskJudge(TradingRoleAgent):
    system_prompt = RISK_JUDGE_PROMPT
    output_schema = RiskJudgeDecision

    def __init__(self):
        super().__init__("risk_judge")

    async def run_node(self, state: TradingAgentState) -> TradingAgentState:
        debate = state.get("risk_debate") or RiskDebateState()
        trader_proposal = state.get("trader_proposal")
        reports = state.get("analyst_reports")
        payload = {
            "trader_proposal": trader_proposal.model_dump() if trader_proposal else None,
            "risk_debate": debate.model_dump(),
            "analyst_reports": reports.model_dump() if reports else None,
        }
        try:
            decision = await self.run_structured(str(payload))
            debate.judge_summary = decision.summary
            debate.final_risk_level = decision.risk_level
            debate.capital_preservation_bias = decision.preservation_bias
            debate.constraints = list(decision.constraints)
            final_decision = FinalDecision(
                action=decision.action,
                confidence=decision.confidence,
                summary=decision.summary,
                reasoning=decision.reasoning,
                portfolio_actions=decision.portfolio_actions,
                decision_source="risk_judge",
                overridden_by_guardrail=False,
            )
            return {
                "risk_debate": debate,
                "final_decision": final_decision,
                "trace": [WorkflowTraceEvent(step="risk_judge", status="completed", detail="Risk judge returned final decision before guardrails.")],
            }
        except TradingAgentError as exc:
            return {"error": f"risk_judge failed: {exc}"}

