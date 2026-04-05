from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from trading_agent.agents.researchers import BEAR_CASE_FALLBACK_MESSAGE, BEAR_CASE_FALLBACK_WARNING
from trading_agent.schemas.input import TradingAgentMeta
from trading_agent.schemas.output import (
    AnalystReports,
    FinalDecision,
    InvestmentDebateState,
    NewsAnalysisReport,
    PortfolioManagerDecision,
    PortfolioStructureReport,
    RiskDebateState,
    SentimentAnalysisReport,
    TechnicalAnalysisReport,
    WorkflowTraceEvent,
)

client = TestClient(app)


@pytest.mark.asyncio
@patch("api.routes.trading_agent.trading_agent_graph.ainvoke", new_callable=AsyncMock)
async def test_trading_agent_endpoint_success(mock_ainvoke):
    mock_ainvoke.return_value = {
        "meta": TradingAgentMeta(
            user_id="user123",
            portfolio_id="user123-trading-agent",
            as_of="2026-04-04T21:00:00+07:00",
            symbols=["BTCUSDT", "ETHUSDT"],
        ),
        "analyst_reports": AnalystReports(
            technical=TechnicalAnalysisReport(
                portfolio_trend="Bullish",
                signal_strength=7,
                strongest_positions=["BTCUSDT"],
                weakest_positions=["ETHUSDT"],
                summary="Momentum is constructive.",
                evidence=["Breadth is positive", "BTC leads the book"],
            ),
            news=NewsAnalysisReport(
                market_bias="Bullish",
                confidence=6,
                catalysts=["ETF demand"],
                headwinds=["Macro still fragile"],
                summary="News tone is constructive.",
            ),
            sentiment=SentimentAnalysisReport(
                sentiment_bias="Bullish",
                confidence=6,
                drivers=["Fear & Greed improved"],
                summary="Sentiment supports measured upside.",
            ),
            portfolio_structure=PortfolioStructureReport(
                diversification_view="Concentrated",
                cash_posture="Balanced",
                concentration_risk="Moderate",
                summary="Portfolio concentration is manageable but notable.",
                actions=["Do not oversize BTC further"],
            ),
        ),
        "investment_debate": InvestmentDebateState(),
        "portfolio_manager_decision": PortfolioManagerDecision(
            stance="Accumulate",
            confidence=6,
            summary="Lean constructive.",
            reasoning=["Trend is supportive", "Risk is not yet critical"],
        ),
        "trader_proposal": None,
        "risk_debate": RiskDebateState(final_risk_level="Moderate"),
        "final_decision": FinalDecision(
            action="Hold",
            confidence=6,
            summary="Maintain current exposure.",
            reasoning=["Signals are constructive but concentration still matters", "Risk remains manageable"],
            portfolio_actions=["Keep allocations steady"],
            decision_source="risk_judge",
        ),
        "trace": [],
        "warnings": [],
        "error": None,
    }

    payload = {
        "user_id": "user123",
        "portfolio": [{"asset": "BTCUSDT", "amount": 0.5, "current_price": 60000}],
        "stablecoin_reserve": 1000,
    }

    response = client.post("/api/trading-agent/evaluate", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert response.json()["workflow_version"] == "trading_agent_v1"


def test_trading_agent_endpoint_validation_error():
    response = client.post("/api/trading-agent/evaluate", json={"user_id": "user123"})
    assert response.status_code == 422


@pytest.mark.asyncio
@patch("api.routes.trading_agent.trading_agent_graph.astream")
async def test_trading_agent_stream_propagates_bear_fallback_warning(mock_astream):
    async def fake_astream(*_args, **_kwargs):
        yield {
            "bear_researcher": {
                "investment_debate": InvestmentDebateState(
                    bear_case=BEAR_CASE_FALLBACK_MESSAGE,
                    latest_message=BEAR_CASE_FALLBACK_MESSAGE,
                    latest_speaker="Bear Researcher",
                    round_count=1,
                ),
                "warnings": [BEAR_CASE_FALLBACK_WARNING],
                "trace": [
                    WorkflowTraceEvent(
                        step="bear_researcher",
                        status="completed",
                        detail="Bear case used fallback content due to empty model output.",
                    )
                ],
            }
        }
        yield {
            "risk_judge": {
                "final_decision": FinalDecision(
                    action="Hold",
                    confidence=6,
                    summary="Maintain current exposure.",
                    reasoning=[
                        "Signals are mixed for now.",
                        "Risk posture still supports holding rather than adding.",
                    ],
                    portfolio_actions=["Keep allocations steady"],
                    decision_source="risk_judge",
                    overridden_by_guardrail=False,
                ),
                "trace": [
                    WorkflowTraceEvent(
                        step="risk_judge",
                        status="completed",
                        detail="Risk judge returned final decision before guardrails.",
                    )
                ],
            }
        }

    mock_astream.side_effect = fake_astream

    payload = {
        "user_id": "user123",
        "portfolio": [{"asset": "BTCUSDT", "amount": 0.5, "current_price": 60000}],
        "stablecoin_reserve": 1000,
    }

    with client.stream("POST", "/api/trading-agent/evaluate/stream", json=payload) as response:
        stream_text = "".join(response.iter_text())

    assert response.status_code == 200
    assert "event: step" in stream_text
    assert "event: done" in stream_text
    assert BEAR_CASE_FALLBACK_WARNING in stream_text
    assert BEAR_CASE_FALLBACK_MESSAGE in stream_text
