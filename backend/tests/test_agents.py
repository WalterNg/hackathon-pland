"""
Tests for all specialist agents (TA, Sentiment, Risk).
Since ChatGoogleGenerativeAI now lives in core.base_agent, we mock BaseAgent.run directly.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from schemas.input import EvaluationPayload, MarketData, PortfolioItem
from schemas.output import TAResult, SentimentResult, RiskResult
from schemas.state import AgentState
from core.base_agent import AgentError


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
def mock_state(mock_payload):
    return AgentState(
        payload=mock_payload,
        ta_result=None,
        sentiment_result=None,
        risk_result=None,
        final_decision=None,
        error=None,
    )


# ─── TA Agent ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_agent_ta_success(mock_state):
    from agents.ta_agent.agent import TAAgent
    agent = TAAgent()
    expected = TAResult(
        trend="Bullish",
        signal_strength=8,
        reasons=["High RVOL", "RSI strong momentum"],
        recommended_action="Accumulate",
    )
    with patch.object(agent, "run", new_callable=AsyncMock, return_value=expected):
        result = await agent.run_node(mock_state)

    assert result["ta_result"] == expected
    assert "error" not in result


@pytest.mark.asyncio
async def test_run_agent_ta_api_error(mock_state):
    from agents.ta_agent.agent import TAAgent
    agent = TAAgent()
    with patch.object(agent, "run", new_callable=AsyncMock, side_effect=AgentError("Gemini API error")):
        result = await agent.run_node(mock_state)

    assert "error" in result
    assert "TA Agent failed" in result["error"]


# ─── Sentiment Agent ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_analyze_sentiment_success(mock_state):
    from agents.sentiment_agent.agent import SentimentAgent
    mock_state["payload"].news_headlines = ["Bitcoin ATH!", "Institutions buying crypto."]
    mock_state["payload"].social_dominance = 55.0

    agent = SentimentAgent()
    expected = SentimentResult(
        sentiment_score=85,
        narrative_summary="Extremely bullish market.",
        bias="Bullish",
    )
    with patch.object(agent, "run", new_callable=AsyncMock, return_value=expected):
        result = await agent.run_node(mock_state)

    assert result["sentiment_result"] == expected
    assert "error" not in result


@pytest.mark.asyncio
async def test_analyze_sentiment_neutral_default(mock_state):
    """No headlines → should return Neutral without calling the LLM."""
    from agents.sentiment_agent.agent import SentimentAgent
    mock_state["payload"].news_headlines = []
    mock_state["payload"].social_dominance = None

    agent = SentimentAgent()
    with patch.object(agent, "run", new_callable=AsyncMock) as mock_run:
        result = await agent.run_node(mock_state)
        mock_run.assert_not_called()

    assert result["sentiment_result"].bias == "Neutral"


# ─── Risk Agent ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_analyze_risk_success(mock_state):
    from agents.risk_agent.agent import RiskAgent
    mock_state["payload"].portfolio = [
        PortfolioItem(asset="BTC", amount=0.5, current_price=60000.0)
    ]
    mock_state["payload"].stablecoin_reserve = 1000.0

    agent = RiskAgent()
    expected = RiskResult(
        risk_level="High",
        recommended_constraints=["Limit new positions", "Increase stablecoin reserve"],
    )
    with patch.object(agent, "run", new_callable=AsyncMock, return_value=expected):
        result = await agent.run_node(mock_state)

    assert result["risk_result"] == expected
    assert "error" not in result


@pytest.mark.asyncio
async def test_analyze_risk_agent_error(mock_state):
    from agents.risk_agent.agent import RiskAgent
    agent = RiskAgent()
    with patch.object(agent, "run", new_callable=AsyncMock, side_effect=AgentError("API down")):
        result = await agent.run_node(mock_state)

    assert "error" in result
    assert "Risk Agent failed" in result["error"]
