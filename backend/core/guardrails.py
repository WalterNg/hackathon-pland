import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from schemas.output import PortfolioDecision
    from schemas.state import AgentState

logger = logging.getLogger("GUARDRAILS")


@dataclass
class GuardrailRule:
    name: str
    condition: Callable[["AgentState"], bool]
    override_action: str
    reason: str


class GuardrailLayer:
    """A pluggable rule engine applied after AI decision synthesis."""

    def __init__(self, rules: list[GuardrailRule]):
        self.rules = rules

    def apply(self, decision: "PortfolioDecision", state: "AgentState") -> "PortfolioDecision":
        from schemas.output import PortfolioDecision as Decision

        for rule in self.rules:
            if rule.condition(state):
                if decision.action != rule.override_action:
                    logger.warning("[%s] overriding '%s' -> '%s'", rule.name, decision.action, rule.override_action)
                    reasoning = list(decision.reasoning)
                    reasoning.append(f"Guardrail {rule.name}: {rule.reason}")
                    actions = list(decision.portfolio_actions)
                    actions.append(f"Respect guardrail override: {rule.override_action}")
                    return Decision(
                        action=rule.override_action,
                        confidence=decision.confidence,
                        summary=decision.summary,
                        reasoning=reasoning,
                        portfolio_actions=actions,
                    )
                logger.info("[%s] action already '%s', no change.", rule.name, decision.action)
        return decision


def _is_critical_risk(state: "AgentState") -> bool:
    risk = state.get("risk_result")
    return risk is not None and risk.risk_level == "Critical"


def _is_high_risk(state: "AgentState") -> bool:
    risk = state.get("risk_result")
    return risk is not None and risk.risk_level == "High"


DEFAULT_GUARDRAILS = GuardrailLayer(
    rules=[
        GuardrailRule(
            name="CriticalRiskStopLoss",
            condition=_is_critical_risk,
            override_action="Stop Loss",
            reason="Portfolio risk is Critical. Immediate capital protection is required.",
        ),
        GuardrailRule(
            name="HighRiskReduce",
            condition=_is_high_risk,
            override_action="Reduce Risk",
            reason="Portfolio risk is High. New aggressive exposure should be reduced.",
        ),
    ]
)
