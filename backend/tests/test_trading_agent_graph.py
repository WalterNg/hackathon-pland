from pathlib import Path
from unittest.mock import patch

import pytest

from trading_agent.graph import trading_agent_graph
from trading_agent.schemas.input import (
    BenchmarkContext,
    NewsContext,
    PortfolioContext,
    PortfolioStructureContext,
    PortfolioTechnicalSummary,
    PositionSnapshot,
    SentimentContext,
    TechnicalContext,
    TradingAgentMeta,
    TradingAgentRequest,
)
from trading_agent.schemas.output import (
    DebateTurn,
    NewsAnalysisReport,
    PortfolioManagerDecision,
    PortfolioStructureReport,
    RiskJudgeDecision,
    SentimentAnalysisReport,
    TechnicalAnalysisReport,
    TraderProposal,
)
from trading_agent.schemas.state import create_trading_agent_state


def sample_context(*_args, **_kwargs) -> tuple[TradingAgentMeta, PortfolioContext, list[str]]:
    meta = TradingAgentMeta(
        user_id="user123",
        portfolio_id="user123-trading-agent",
        as_of="2026-04-04T21:00:00+07:00",
        symbols=["BTCUSDT", "ETHUSDT"],
    )
    positions = [
        PositionSnapshot(symbol="BTCUSDT", weight=0.6, quantity=0.5, current_price=60000, value_usd=30000),
        PositionSnapshot(symbol="ETHUSDT", weight=0.25, quantity=4, current_price=3000, value_usd=12000),
    ]
    context = PortfolioContext(
        technical=TechnicalContext(
            cash_ratio=0.15,
            positions=positions,
            per_asset_signals=[],
            portfolio_technical_summary=PortfolioTechnicalSummary(
                weighted_avg_rsi=58,
                bullish_weight_ratio=0.6,
                bearish_weight_ratio=0.1,
                above_ma50_weight_ratio=0.75,
                high_rvol_weight_ratio=0.4,
                technical_breadth="Constructive",
            ),
            benchmark_context=BenchmarkContext(primary_symbol="BTCUSDT", primary_trend="Bullish", market_regime="Risk-on"),
        ),
        news=NewsContext(
            portfolio_symbols=["BTCUSDT", "ETHUSDT"],
            news_headlines=["ETF inflows remain strong"],
            dominant_narrative="Majors are still leading the tape.",
            macro_context={"market_regime": "Risk-on"},
        ),
        sentiment=SentimentContext(
            social_sentiment_score=63,
            dominant_narrative="Crypto sentiment remains constructive.",
            sentiment_label="Bullish",
        ),
        structure=PortfolioStructureContext(
            cash_ratio=0.15,
            positions=positions,
            top1_weight=0.6,
            top2_weight=0.85,
            concentration_score=0.72,
            estimated_volatility=1.4,
            liquidity_condition="Normal",
        ),
    )
    return meta, context, []


async def fake_invoke(*args, **kwargs):
    output_schema = kwargs.get("output_schema") or args[-1]
    system_prompt = kwargs.get("system_prompt") or args[-3]
    mapping = {
        "TechnicalAnalysisReport": TechnicalAnalysisReport(
            portfolio_trend="Bullish",
            signal_strength=7,
            strongest_positions=["BTCUSDT"],
            weakest_positions=["ETHUSDT"],
            summary="Technical setup is constructive.",
            evidence=["Breadth is positive", "BTC is leading"],
        ),
        "NewsAnalysisReport": NewsAnalysisReport(
            market_bias="Bullish",
            confidence=6,
            catalysts=["ETF inflows"],
            headwinds=["Macro still fragile"],
            summary="External narrative remains constructive.",
        ),
        "SentimentAnalysisReport": SentimentAnalysisReport(
            sentiment_bias="Bullish",
            confidence=6,
            drivers=["Fear & Greed rising"],
            summary="Sentiment supports measured upside.",
        ),
        "PortfolioStructureReport": PortfolioStructureReport(
            diversification_view="Concentrated",
            cash_posture="Balanced",
            concentration_risk="Moderate",
            summary="Structure is concentrated but still workable.",
            actions=["Avoid increasing top position size too aggressively"],
        ),
        "DebateTurn": DebateTurn(
            speaker=(
                "Bull Researcher" if "bullish researcher" in system_prompt.lower()
                else "Bear Researcher" if "bearish researcher" in system_prompt.lower()
                else "Aggressive Risk Analyst" if "aggressive risk analyst" in system_prompt.lower()
                else "Conservative Risk Analyst" if "conservative risk analyst" in system_prompt.lower()
                else "Neutral Risk Analyst"
            ),
            stance=(
                "Bullish" if "bullish researcher" in system_prompt.lower()
                else "Bearish" if "bearish researcher" in system_prompt.lower()
                else "Aggressive" if "aggressive risk analyst" in system_prompt.lower()
                else "Conservative" if "conservative risk analyst" in system_prompt.lower()
                else "Neutral"
            ),
            message="Structured debate message.",
        ),
        "PortfolioManagerDecision": PortfolioManagerDecision(
            stance="Accumulate",
            confidence=7,
            summary="Manager leans constructive.",
            reasoning=["Bull case is stronger", "Risk is not yet elevated enough to block upside"],
        ),
        "TraderProposal": TraderProposal(
            action="Accumulate",
            confidence=7,
            thesis="Add selectively while keeping sizing disciplined.",
            implementation_steps=["Scale into BTC gradually", "Keep cash reserve intact"],
        ),
        "RiskJudgeDecision": RiskJudgeDecision(
            risk_level="High",
            preservation_bias="Defensive",
            constraints=["Trim if volatility expands"],
            action="Accumulate",
            confidence=6,
            summary="Upside exists but risk is elevated.",
            reasoning=["Structure is concentrated", "High risk should temper new exposure"],
            portfolio_actions=["Do not add aggressively"],
        ),
    }
    return mapping[output_schema.__name__]


@pytest.mark.asyncio
async def test_trading_agent_graph_happy_path_guardrail_override():
    request = TradingAgentRequest(
        user_id="user123",
        portfolio=[{"asset": "BTCUSDT", "amount": 0.5, "current_price": 60000}],
        stablecoin_reserve=1000,
        news_headlines=[],
        social_dominance=0,
    )

    with patch("trading_agent.graph.build_trading_context", side_effect=sample_context), patch(
        "trading_agent.core.llm_clients.GeminiClient.invoke_structured",
        side_effect=fake_invoke,
    ):
        final_state = await trading_agent_graph.ainvoke(create_trading_agent_state(request))

    assert final_state["final_decision"].action == "Reduce Risk"
    assert final_state["final_decision"].overridden_by_guardrail is True
    assert any(event.step == "finalize_response" for event in final_state["trace"])


@pytest.mark.asyncio
async def test_trading_agent_graph_missing_portfolio_fails_fast():
    request = TradingAgentRequest(user_id="user123", portfolio=[], stablecoin_reserve=0, news_headlines=[], social_dominance=0)
    final_state = await trading_agent_graph.ainvoke(create_trading_agent_state(request))
    assert "portfolio must contain at least one asset" in final_state["error"]


def test_trading_agent_has_no_tradingagents_import_dependency():
    root = Path("backend/trading_agent")
    offenders: list[str] = []

    for path in root.rglob("*.py"):
        content = path.read_text(encoding="utf-8")
        if "TradingAgents" in content or "from TradingAgents" in content or "import TradingAgents" in content:
            offenders.append(str(path))

    assert offenders == []
