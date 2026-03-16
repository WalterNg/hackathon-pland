"""
Tests for the SynthesisAgent and GuardrailLayer.

Since the SynthesisAgent itself calls an LLM, we test:
1. The GuardrailLayer rules directly (deterministic, no LLM needed)
2. The SynthesisAgent's error passthrough and missing TA fallback behavior
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from schemas.input import EvaluationPayload, MarketData
from schemas.output import TAResult, SentimentResult, RiskResult, FinalDecision
from schemas.state import AgentState
from core.guardrails import DEFAULT_GUARDRAILS, GuardrailLayer, GuardrailRule


@pytest.fixture
def mock_payload():
    return EvaluationPayload(
        user_id="user123",
        portfolio=[],
        stablecoin_reserve=1000.0,
        market_data=MarketData(
            rvol=2.0,
            ma50=50000.0,
            rsi=65.0,
            bollinger_bands="Upper",
            obv=2000000.0,
        ),
    )


@pytest.fixture
def bullish_ta():
    return TAResult(
        trend="Bullish",
        signal_strength=8,
        reasons=["Strong RVOL", "RSI expanding"],
        recommended_action="Accumulate",
    )


# ─── GuardrailLayer unit tests ────────────────────────────────────────────────

def test_guardrail_critical_risk_overrides_to_stop_loss(mock_payload, bullish_ta):
    risk = RiskResult(risk_level="Critical", recommended_constraints=["Stop all positions"])
    state = AgentState(
        payload=mock_payload,
        ta_result=bullish_ta,
        sentiment_result=None,
        risk_result=risk,
        final_decision=None,
        error=None,
    )
    raw_decision = FinalDecision(action="Accumulate", reasoning="AI wants to buy.")
    result = DEFAULT_GUARDRAILS.apply(raw_decision, state)

    assert result.action == "Stop Loss"
    assert "GUARDRAIL" in result.reasoning
    assert "CriticalRiskStopLoss" in result.reasoning


def test_guardrail_high_risk_overrides_to_hold(mock_payload, bullish_ta):
    risk = RiskResult(risk_level="High", recommended_constraints=["Reduce exposure"])
    state = AgentState(
        payload=mock_payload,
        ta_result=bullish_ta,
        sentiment_result=None,
        risk_result=risk,
        final_decision=None,
        error=None,
    )
    raw_decision = FinalDecision(action="Accumulate", reasoning="AI wants to buy.")
    result = DEFAULT_GUARDRAILS.apply(raw_decision, state)

    assert result.action == "Hold"
    assert "GUARDRAIL" in result.reasoning
    assert "HighRiskHold" in result.reasoning


def test_guardrail_no_override_when_low_risk(mock_payload, bullish_ta):
    risk = RiskResult(risk_level="Low", recommended_constraints=["All good"])
    state = AgentState(
        payload=mock_payload,
        ta_result=bullish_ta,
        sentiment_result=None,
        risk_result=risk,
        final_decision=None,
        error=None,
    )
    raw_decision = FinalDecision(action="Accumulate", reasoning="AI wants to buy.")
    result = DEFAULT_GUARDRAILS.apply(raw_decision, state)

    assert result.action == "Accumulate"
    assert "GUARDRAIL" not in result.reasoning


def test_guardrail_no_change_when_already_correct_action(mock_payload, bullish_ta):
    """If AI already chose the same action as the guardrail, no change is made."""
    risk = RiskResult(risk_level="High", recommended_constraints=["Hold"])
    state = AgentState(
        payload=mock_payload,
        ta_result=bullish_ta,
        sentiment_result=None,
        risk_result=risk,
        final_decision=None,
        error=None,
    )
    raw_decision = FinalDecision(action="Hold", reasoning="AI decided to hold.")
    result = DEFAULT_GUARDRAILS.apply(raw_decision, state)

    assert result.action == "Hold"
    assert "GUARDRAIL" not in result.reasoning


def test_guardrail_custom_rule():
    """Test adding a custom rule to a GuardrailLayer."""
    custom_layer = GuardrailLayer(rules=[
        GuardrailRule(
            name="BearishHold",
            condition=lambda state: state.get("ta_result") and state["ta_result"].trend == "Bearish",
            override_action="Hold",
            reason="TA trend is Bearish.",
        )
    ])
    ta = TAResult(trend="Bearish", signal_strength=3, reasons=["Downtrend", "Volume declining"], recommended_action="Stop Loss")
    state = AgentState(
        payload=MagicMock(),
        ta_result=ta,
        sentiment_result=None,
        risk_result=None,
        final_decision=None,
        error=None,
    )
    raw_decision = FinalDecision(action="Accumulate", reasoning="Some AI reasoning.")
    result = custom_layer.apply(raw_decision, state)

    assert result.action == "Hold"
    assert "BearishHold" in result.reasoning


# ─── SynthesisAgent behavior tests ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_synthesis_agent_passthrough_on_error(mock_payload):
    """Error state should be passed through without calling the LLM."""
    from agents.synthesis_agent.agent import synthesize

    state = AgentState(
        payload=mock_payload,
        ta_result=None,
        sentiment_result=None,
        risk_result=None,
        final_decision=None,
        error="TA Agent failed",
    )
    result = await synthesize(state)
    assert result.get("error") == "TA Agent failed"


@pytest.mark.asyncio
async def test_synthesis_agent_missing_ta_returns_error(mock_payload):
    """Missing TA result should return an error state."""
    from agents.synthesis_agent.agent import synthesize

    state = AgentState(
        payload=mock_payload,
        ta_result=None,
        sentiment_result=None,
        risk_result=None,
        final_decision=None,
        error=None,
    )
    result = await synthesize(state)
    assert "error" in result


@pytest.mark.asyncio
async def test_synthesis_agent_applies_guardrails(mock_payload, bullish_ta):
    """When LLM returns 'Accumulate' but risk is Critical, guardrail should override."""
    from agents.synthesis_agent.agent import SynthesisAgent

    agent = SynthesisAgent()
    mock_decision = FinalDecision(action="Accumulate", reasoning="AI says buy.")

    with patch.object(agent, "run", new_callable=AsyncMock, return_value=mock_decision):
        risk = RiskResult(risk_level="Critical", recommended_constraints=["Stop Loss"])
        state = AgentState(
            payload=mock_payload,
            ta_result=bullish_ta,
            sentiment_result=None,
            risk_result=risk,
            final_decision=None,
            error=None,
        )
        result = await agent.run_node(state)

    decision = result["final_decision"]
    assert decision.action == "Stop Loss"
    assert "CriticalRiskStopLoss" in decision.reasoning
