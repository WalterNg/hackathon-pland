import pytest
from agents.ta_agent.agent import analyze_technical
from schemas.input import EvaluationPayload, MarketData
from schemas.output import TAResult
from schemas.state import AgentState
from unittest.mock import AsyncMock, patch
from langchain_core.messages import BaseMessage

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

@pytest.fixture
def mock_state(mock_payload):
    return AgentState(
        payload=mock_payload,
        ta_result=None,
        sentiment_result=None,
        risk_result=None,
        final_decision=None,
        error=None
    )

@pytest.mark.asyncio
@patch("agents.ta_agent.agent.ChatGoogleGenerativeAI")
async def test_analyze_technical_success(mock_chat_class, mock_state):
    # Mock the LLM chain
    mock_llm_instance = mock_chat_class.return_value
    mock_structured_llm = AsyncMock()
    mock_llm_instance.with_structured_output.return_value = mock_structured_llm
    
    mock_ta_result = TAResult(
        trend="Bullish",
        signal_strength=8,
        reasons=["High RVOL", "RSI Overbought but strong momentum"],
        recommended_action="Take Profit"
    )
    mock_structured_llm.ainvoke.return_value = mock_ta_result

    # Run the function
    result_state = await analyze_technical(mock_state)
    
    assert "ta_result" in result_state
    assert result_state["ta_result"] == mock_ta_result
    assert "error" not in result_state or result_state["error"] is None

@pytest.mark.asyncio
@patch("agents.ta_agent.agent.ChatGoogleGenerativeAI")
async def test_analyze_technical_api_error(mock_chat_class, mock_state):
    from google.api_core.exceptions import GoogleAPIError
    
    mock_llm_instance = mock_chat_class.return_value
    mock_structured_llm = AsyncMock()
    mock_llm_instance.with_structured_output.return_value = mock_structured_llm
    
    mock_structured_llm.ainvoke.side_effect = GoogleAPIError("API limit exceeded")

    result_state = await analyze_technical(mock_state)
    
    assert "error" in result_state
    assert result_state["error"] == "TA Agent LLM API failed"


@pytest.mark.asyncio
@patch("agents.sentiment_agent.agent.ChatGoogleGenerativeAI")
async def test_analyze_sentiment_success(mock_chat_class, mock_state):
    from agents.sentiment_agent.agent import analyze_sentiment
    from schemas.output import SentimentResult
    
    # Add dummy news to payload for this test
    mock_state["payload"].news_headlines = ["Bitcoin reaches new ATH!", "Institutions are buying crypto."]
    mock_state["payload"].social_dominance = 55.0

    mock_llm_instance = mock_chat_class.return_value
    mock_structured_llm = AsyncMock()
    mock_llm_instance.with_structured_output.return_value = mock_structured_llm
    
    mock_sent_result = SentimentResult(
        sentiment_score=85,
        narrative_summary="Extremely bullish market driven by ETF inflows.",
        bias="Bullish"
    )
    mock_structured_llm.ainvoke.return_value = mock_sent_result

    result_state = await analyze_sentiment(mock_state)
    
    assert "sentiment_result" in result_state
    assert result_state["sentiment_result"] == mock_sent_result
    assert "error" not in result_state or result_state["error"] is None

@pytest.mark.asyncio
@patch("agents.risk_agent.agent.ChatGoogleGenerativeAI")
async def test_analyze_risk_success(mock_chat_class, mock_state):
    from agents.risk_agent.agent import analyze_risk
    from schemas.output import RiskResult
    from schemas.input import PortfolioItem

    # Add dummy portfolio to hit some risk rules conditionally
    mock_state["payload"].portfolio = [PortfolioItem(asset="BTC", amount=0.5, current_price=60000.0)]
    mock_state["payload"].stablecoin_reserve = 1000.0 # High risk (low reserve relative to 30k portfolio)

    mock_llm_instance = mock_chat_class.return_value
    mock_structured_llm = AsyncMock()
    mock_llm_instance.with_structured_output.return_value = mock_structured_llm
    
    mock_risk_result = RiskResult(
        risk_level="Critical",
        recommended_constraints=["Only allow Hold or Stop Loss", "Sell assets to increase stablecoin reserve"]
    )
    mock_structured_llm.ainvoke.return_value = mock_risk_result

    result_state = await analyze_risk(mock_state)
    
    assert "risk_result" in result_state
    assert result_state["risk_result"] == mock_risk_result
    assert "error" not in result_state or result_state["error"] is None

