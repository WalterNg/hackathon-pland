"""Tests for the portfolio-level synthesis agent and guardrails."""

import pytest
from unittest.mock import AsyncMock, patch

from core.guardrails import DEFAULT_GUARDRAILS, GuardrailLayer, GuardrailRule
from schemas.input import GraphMeta
from schemas.output import (
    PortfolioDecision,
    PortfolioNewsMarketResult,
    PortfolioRiskResult,
    PortfolioTAResult,
)
from schemas.state import create_agent_state


@pytest.fixture
def mock_meta():
    return GraphMeta(
        user_id="user123",
        portfolio_id="user123-portfolio",
        as_of="2026-03-20T10:00:00+07:00",
        symbols=["BTCUSDT", "ETHUSDT"],
    )


@pytest.fixture
def bullish_ta():
    return PortfolioTAResult(
        portfolio_trend="Bullish",
        signal_strength=8,
        strongest_positions=["BTCUSDT"],
        weakest_positions=["ETHUSDT"],
        reasons=["Breadth is positive", "Most weight is above MA50"],
        recommended_action="Accumulate",
    )


def _base_state(mock_meta, **overrides):
    state = create_agent_state(meta=mock_meta)
    state.update(overrides)
    return state


def test_guardrail_critical_risk_overrides_to_stop_loss(mock_meta, bullish_ta):
    risk = PortfolioRiskResult(
        risk_level="Critical",
        risk_alerts=["Liquidity is breaking down"],
        recommended_constraints=["Exit risk aggressively"],
        capital_preservation_bias="Defensive",
    )
    state = _base_state(mock_meta, ta_result=bullish_ta, risk_result=risk)
    raw_decision = PortfolioDecision(
        action="Accumulate",
        confidence=7,
        summary="AI wants to add risk.",
        reasoning=["Upside looks strong", "Momentum is positive"],
        portfolio_actions=["Add to winners"],
    )
    result = DEFAULT_GUARDRAILS.apply(raw_decision, state)

    assert result.action == "Stop Loss"
    assert any("CriticalRiskStopLoss" in line for line in result.reasoning)


def test_guardrail_high_risk_overrides_to_reduce_risk(mock_meta, bullish_ta):
    risk = PortfolioRiskResult(
        risk_level="High",
        risk_alerts=["Concentration is elevated"],
        recommended_constraints=["Trim exposure"],
        capital_preservation_bias="Defensive",
    )
    state = _base_state(mock_meta, ta_result=bullish_ta, risk_result=risk)
    raw_decision = PortfolioDecision(
        action="Accumulate",
        confidence=6,
        summary="AI wants to add risk.",
        reasoning=["TA is constructive", "Sentiment is decent"],
        portfolio_actions=["Increase exposure"],
    )
    result = DEFAULT_GUARDRAILS.apply(raw_decision, state)

    assert result.action == "Reduce Risk"
    assert any("HighRiskReduce" in line for line in result.reasoning)


def test_guardrail_custom_rule(mock_meta):
    custom_layer = GuardrailLayer(
        rules=[
            GuardrailRule(
                name="BearishHold",
                condition=lambda state: state.get("ta_result") and state["ta_result"].portfolio_trend == "Bearish",
                override_action="Hold",
                reason="Portfolio technical trend is Bearish.",
            )
        ]
    )
    ta = PortfolioTAResult(
        portfolio_trend="Bearish",
        signal_strength=3,
        strongest_positions=[],
        weakest_positions=["BTCUSDT"],
        reasons=["Weak breadth", "RSI is deteriorating"],
        recommended_action="Reduce Risk",
    )
    state = _base_state(mock_meta, ta_result=ta)
    raw_decision = PortfolioDecision(
        action="Accumulate",
        confidence=5,
        summary="Some AI reasoning.",
        reasoning=["Trying to buy weakness", "Risk may be worth it"],
        portfolio_actions=["Add selectively"],
    )
    result = custom_layer.apply(raw_decision, state)

    assert result.action == "Hold"


@pytest.mark.asyncio
async def test_synthesis_agent_passthrough_on_error(mock_meta):
    from agents.synthesis_agent.agent import run_agent

    state = _base_state(mock_meta, error="TA Agent failed")
    result = await run_agent(state)
    assert result.get("error") == "TA Agent failed"


@pytest.mark.asyncio
async def test_synthesis_agent_missing_ta_returns_error(mock_meta):
    from agents.synthesis_agent.agent import run_agent

    state = _base_state(mock_meta, ta_result=None)
    result = await run_agent(state)
    assert "error" in result


@pytest.mark.asyncio
async def test_synthesis_agent_applies_guardrails(mock_meta, bullish_ta):
    from agents.synthesis_agent.agent import SynthesisAgent

    agent = SynthesisAgent()
    mock_decision = PortfolioDecision(
        action="Accumulate",
        confidence=7,
        summary="Buy the portfolio dip.",
        reasoning=["Technicals are strong", "Risk seems manageable"],
        portfolio_actions=["Add to BTC"],
    )

    with patch.object(agent, "run", new_callable=AsyncMock, return_value=mock_decision):
        risk = PortfolioRiskResult(
            risk_level="Critical",
            risk_alerts=["Critical drawdown risk"],
            recommended_constraints=["De-risk immediately"],
            capital_preservation_bias="Defensive",
        )
        news = PortfolioNewsMarketResult(
            market_bias="Bullish",
            confidence=7,
            key_catalysts=["ETF inflows"],
            portfolio_headwinds=[],
            narrative_summary="Narrative is supportive.",
        )
        state = _base_state(mock_meta, ta_result=bullish_ta, news_market_result=news, risk_result=risk)
        result = await agent.run_node(state)

    assert result["final_decision"].action == "Stop Loss"
