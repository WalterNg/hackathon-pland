"""Tests for the portfolio-level specialist agents."""

import pytest
from unittest.mock import AsyncMock, patch

from core.base_agent import AgentError
from schemas.input import (
    AssetTechnicalSnapshot,
    BenchmarkContext,
    GraphMeta,
    MarketRiskContext,
    PortfolioMetrics,
    PortfolioNewsMarketInput,
    PortfolioRiskInput,
    PortfolioTAInput,
    PortfolioTechnicalSummary,
    PositionSnapshot,
    TechnicalRiskSignals,
)
from schemas.output import PortfolioNewsMarketResult, PortfolioRiskResult, PortfolioTAResult
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
def mock_positions():
    return [
        PositionSnapshot(symbol="BTCUSDT", weight=0.6, quantity=0.5, current_price=60000, value_usd=30000),
        PositionSnapshot(symbol="ETHUSDT", weight=0.3, quantity=4.0, current_price=3000, value_usd=12000),
    ]


@pytest.fixture
def mock_ta_input(mock_positions):
    return PortfolioTAInput(
        cash_ratio=0.1,
        positions=mock_positions,
        per_asset_signals=[
            AssetTechnicalSnapshot(
                symbol="BTCUSDT",
                rsi=62,
                ma50_gap_pct=5.0,
                bollinger_position="Upper",
                rvol=1.5,
                obv_trend="Up",
                trend="Bullish",
                signal_strength=8,
            ),
            AssetTechnicalSnapshot(
                symbol="ETHUSDT",
                rsi=52,
                ma50_gap_pct=1.2,
                bollinger_position="Middle",
                rvol=1.1,
                obv_trend="Flat",
                trend="Neutral",
                signal_strength=5,
            ),
        ],
        portfolio_technical_summary=PortfolioTechnicalSummary(
            weighted_avg_rsi=58,
            bullish_weight_ratio=0.6,
            bearish_weight_ratio=0.0,
            above_ma50_weight_ratio=0.9,
            high_rvol_weight_ratio=0.6,
            technical_breadth="Broadly Bullish",
        ),
        benchmark_context=BenchmarkContext(
            primary_symbol="BTCUSDT",
            primary_trend="Bullish",
            market_regime="Risk-on",
        ),
    )


@pytest.fixture
def mock_news_input():
    return PortfolioNewsMarketInput(
        portfolio_symbols=["BTCUSDT", "ETHUSDT"],
        news_headlines=["Bitcoin ETF inflows stay strong", "Ethereum network usage rises"],
        social_sentiment_score=68,
        dominant_narrative="Majors continue to lead market sentiment.",
        macro_context={"market_regime": "Risk-on"},
    )


@pytest.fixture
def mock_risk_input(mock_positions):
    return PortfolioRiskInput(
        cash_ratio=0.1,
        positions=mock_positions,
        portfolio_metrics=PortfolioMetrics(
            asset_count=2,
            top1_weight=0.6,
            top2_weight=0.9,
            concentration_score=0.72,
            estimated_volatility=1.34,
        ),
        technical_risk_signals=TechnicalRiskSignals(
            bearish_weight_ratio=0.1,
            weak_trend_concentration=0.3,
            high_rvol_weight_ratio=0.6,
        ),
        market_risk_context=MarketRiskContext(
            market_regime="Risk-on",
            liquidity_condition="Normal",
        ),
    )


@pytest.fixture
def mock_state(mock_meta, mock_ta_input, mock_news_input, mock_risk_input):
    return create_agent_state(
        meta=mock_meta,
        ta_input=mock_ta_input,
        news_market_input=mock_news_input,
        risk_input=mock_risk_input,
    )


@pytest.mark.asyncio
async def test_run_ta_agent_success(mock_state):
    from agents.ta_agent.agent import TAAgent

    agent = TAAgent()
    expected = PortfolioTAResult(
        portfolio_trend="Bullish",
        signal_strength=8,
        strongest_positions=["BTCUSDT"],
        weakest_positions=["ETHUSDT"],
        reasons=["60% of weight is bullish", "Most positions are above MA50"],
        recommended_action="Accumulate",
    )

    with patch.object(agent, "run", new_callable=AsyncMock, return_value=expected):
        result = await agent.run_node(mock_state)

    assert result["ta_result"] == expected
    assert "error" not in result


@pytest.mark.asyncio
async def test_run_ta_agent_error(mock_state):
    from agents.ta_agent.agent import TAAgent

    agent = TAAgent()
    with patch.object(agent, "run", new_callable=AsyncMock, side_effect=AgentError("Gemini API error")):
        result = await agent.run_node(mock_state)

    assert "error" in result


@pytest.mark.asyncio
async def test_run_news_market_agent_success(mock_state):
    from agents.sentiment_agent.agent import SentimentAgent

    agent = SentimentAgent()
    expected = PortfolioNewsMarketResult(
        market_bias="Bullish",
        confidence=7,
        key_catalysts=["ETF inflows", "Strong network usage"],
        portfolio_headwinds=["Macro remains sensitive"],
        narrative_summary="News flow is supportive for majors.",
    )

    with patch.object(agent, "run", new_callable=AsyncMock, return_value=expected):
        result = await agent.run_node(mock_state)

    assert result["news_market_result"] == expected
    assert "error" not in result


@pytest.mark.asyncio
async def test_run_news_market_agent_neutral_default(mock_state):
    from agents.sentiment_agent.agent import SentimentAgent

    mock_state["news_market_input"] = PortfolioNewsMarketInput(
        portfolio_symbols=[],
        news_headlines=[],
        social_sentiment_score=0,
        dominant_narrative="No strong narrative.",
        macro_context={},
    )

    agent = SentimentAgent()
    with patch.object(agent, "run", new_callable=AsyncMock) as mock_run:
        result = await agent.run_node(mock_state)
        mock_run.assert_not_called()

    assert result["news_market_result"].market_bias == "Neutral"


@pytest.mark.asyncio
async def test_run_risk_agent_success(mock_state):
    from agents.risk_agent.agent import RiskAgent

    agent = RiskAgent()
    expected = PortfolioRiskResult(
        risk_level="Moderate",
        risk_alerts=["Portfolio is moderately concentrated"],
        recommended_constraints=["Maintain cash buffer"],
        capital_preservation_bias="Neutral",
    )

    with patch.object(agent, "run", new_callable=AsyncMock, return_value=expected):
        result = await agent.run_node(mock_state)

    assert result["risk_result"] == expected
    assert "error" not in result
