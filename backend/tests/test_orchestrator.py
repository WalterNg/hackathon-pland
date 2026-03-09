import pytest
from agents.orchestrator import base_orchestrator
from schemas.input import EvaluationPayload, MarketData
from schemas.output import TAResult
from schemas.state import AgentState

@pytest.fixture
def mock_payload():
    return EvaluationPayload(
        user_id="user123",
        portfolio=[],
        stablecoin_reserve=1000.0,
        market_data=MarketData(
            rvol=2.0,
            ma50=50000.0,
            rsi=80.0,
            bollinger_bands="Above Upper",
            obv=2000000.0
        )
    )

@pytest.mark.asyncio
async def test_base_orchestrator_success(mock_payload):
    from schemas.output import SentimentResult
    
    ta_result = TAResult(
        trend="Bullish",
        signal_strength=8,
        reasons=["Reason 1", "Reason 2"],
        recommended_action="Accumulate"
    )
    sentiment_result = SentimentResult(
        sentiment_score=80,
        narrative_summary="Bullish narrative",
        bias="Bullish"
    )
    
    state = AgentState(
        payload=mock_payload,
        ta_result=ta_result,
        sentiment_result=sentiment_result,
        risk_result=None,
        final_decision=None,
        error=None
    )
    
    result_state = await base_orchestrator(state)
    
    assert "final_decision" in result_state
    decision = result_state["final_decision"]
    assert decision.action == "Accumulate"
    assert "TA (Bullish)" in decision.reasoning
    assert "Sentiment (Bullish, Score 80)" in decision.reasoning

@pytest.mark.asyncio
async def test_base_orchestrator_conflict(mock_payload):
    from schemas.output import SentimentResult, RiskResult
    
    ta_result = TAResult(
        trend="Bullish",
        signal_strength=5,
        reasons=["Low volume pump", "RSI is still okay"],
        recommended_action="Accumulate"
    )
    sentiment_result = SentimentResult(
        sentiment_score=20,
        narrative_summary="Terrible news, market crashing",
        bias="Bearish"
    )
    
    state = AgentState(
        payload=mock_payload,
        ta_result=ta_result,
        sentiment_result=sentiment_result,
        risk_result=None,
        final_decision=None,
        error=None
    )
    
    result_state = await base_orchestrator(state)
    
    assert "final_decision" in result_state
    decision = result_state["final_decision"]
    
    # TA was bullish but sentiment was bearish, so it should downgrade to Hold
    assert decision.action == "Hold"
    assert "Conflicting signals" in decision.reasoning

@pytest.mark.asyncio
async def test_base_orchestrator_risk_override(mock_payload):
    from schemas.output import SentimentResult, RiskResult
    
    ta_result = TAResult(
        trend="Bullish",
        signal_strength=9,
        reasons=["Great setup", "RSI expanding"],
        recommended_action="Accumulate"
    )
    sentiment_result = SentimentResult(
        sentiment_score=90,
        narrative_summary="Amazing news",
        bias="Bullish"
    )
    risk_result = RiskResult(
        risk_level="Critical",
        recommended_constraints=["Stop everything immediately"]
    )
    
    state = AgentState(
        payload=mock_payload,
        ta_result=ta_result,
        sentiment_result=sentiment_result,
        risk_result=risk_result,
        final_decision=None,
        error=None
    )
    
    result_state = await base_orchestrator(state)
    
    assert "final_decision" in result_state
    decision = result_state["final_decision"]
    
    # Risk is Critical, overridden -> Stop Loss
    assert decision.action == "Stop Loss"
    assert "RISK OVERRIDE" in decision.reasoning
    assert "Risk (Critical)" in decision.reasoning

@pytest.mark.asyncio
async def test_base_orchestrator_error_passthrough(mock_payload):
    state = AgentState(
        payload=mock_payload,
        ta_result=None,
        sentiment_result=None,
        risk_result=None,
        final_decision=None,
        error="Some error from TA agent"
    )
    
    result_state = await base_orchestrator(state)
    assert result_state["error"] == "Some error from TA agent"
    assert "final_decision" not in result_state or result_state.get("final_decision") is None
