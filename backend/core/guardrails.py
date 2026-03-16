import logging
from dataclasses import dataclass, field
from typing import Callable, TYPE_CHECKING

if TYPE_CHECKING:
    from schemas.state import AgentState
    from schemas.output import FinalDecision

logger = logging.getLogger("GUARDRAILS")


@dataclass
class GuardrailRule:
    """
    A single safety rule applied after the AI synthesis decision.

    Attributes:
        name: Human-readable identifier for logging.
        condition: Callable that receives state and returns True if this rule should trigger.
        override_action: The action to enforce when condition is True.
        reason: Message appended to the decision's reasoning when triggered.
    """
    name: str
    condition: Callable[["AgentState"], bool]
    override_action: str
    reason: str


class GuardrailLayer:
    """
    A pluggable rule engine applied after AI decision synthesis.
    Rules are evaluated in order. First matching rule wins.

    Usage:
        layer = GuardrailLayer(rules=[...])
        safe_decision = layer.apply(raw_decision, state)

    To add new rules, simply append more GuardrailRule instances to the list.
    """

    def __init__(self, rules: list[GuardrailRule]):
        self.rules = rules

    def apply(self, decision: "FinalDecision", state: "AgentState") -> "FinalDecision":
        from schemas.output import FinalDecision as FD

        for rule in self.rules:
            if rule.condition(state):
                if decision.action != rule.override_action:
                    logger.warning(
                        f"[{rule.name}] Activated — "
                        f"overriding '{decision.action}' → '{rule.override_action}'"
                    )
                    return FD(
                        action=rule.override_action,
                        reasoning=f"{decision.reasoning} [GUARDRAIL '{rule.name}': {rule.reason}]"
                    )
                else:
                    logger.info(f"[{rule.name}] Evaluated — action already '{decision.action}', no change.")
        return decision


# -------------------------------------------------------------------
# Default risk-based guardrails (used by synthesis_agent)
# Add new rules here to register them globally.
# -------------------------------------------------------------------
def _is_critical_risk(state: "AgentState") -> bool:
    risk = state.get("risk_result")
    return risk is not None and risk.risk_level == "Critical"

def _is_high_risk(state: "AgentState") -> bool:
    risk = state.get("risk_result")
    return risk is not None and risk.risk_level == "High"


DEFAULT_GUARDRAILS = GuardrailLayer(rules=[
    GuardrailRule(
        name="CriticalRiskStopLoss",
        condition=_is_critical_risk,
        override_action="Stop Loss",
        reason="Portfolio risk is Critical. Immediate capital protection required.",
    ),
    GuardrailRule(
        name="HighRiskHold",
        condition=_is_high_risk,
        override_action="Hold",
        reason="Portfolio risk is High. Halting aggressive actions until risk decreases.",
    ),
])
