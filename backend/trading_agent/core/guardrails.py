from dataclasses import dataclass
from typing import Callable

from trading_agent.schemas.output import FinalDecision
from trading_agent.schemas.state import TradingAgentState


@dataclass
class GuardrailRule:
    name: str
    condition: Callable[[TradingAgentState], bool]
    override_action: str
    reason: str


class TradingGuardrailLayer:
    def __init__(self, rules: list[GuardrailRule]):
        self.rules = rules

    def apply(self, decision: FinalDecision, state: TradingAgentState) -> FinalDecision:
        for rule in self.rules:
            if rule.condition(state) and decision.action != rule.override_action:
                reasoning = list(decision.reasoning)
                reasoning.append(f"Guardrail {rule.name}: {rule.reason}")
                actions = list(decision.portfolio_actions)
                actions.append(f"Respect guardrail override: {rule.override_action}")
                return FinalDecision(
                    action=rule.override_action,
                    confidence=decision.confidence,
                    summary=decision.summary,
                    reasoning=reasoning,
                    portfolio_actions=actions,
                    decision_source="guardrail_override",
                    overridden_by_guardrail=True,
                )
        return decision


def _risk_level(state: TradingAgentState) -> str:
    risk_debate = state.get("risk_debate")
    if not risk_debate:
        return "Moderate"
    return risk_debate.final_risk_level


DEFAULT_TRADING_GUARDRAILS = TradingGuardrailLayer(
    rules=[
        GuardrailRule(
            name="CriticalRiskStopLoss",
            condition=lambda state: _risk_level(state) == "Critical",
            override_action="Stop Loss",
            reason="Risk judge marked the portfolio as Critical.",
        ),
        GuardrailRule(
            name="HighRiskReduce",
            condition=lambda state: _risk_level(state) == "High",
            override_action="Reduce Risk",
            reason="Risk judge marked the portfolio as High risk.",
        ),
    ]
)
