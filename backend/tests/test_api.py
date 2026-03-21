from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from schemas.input import GraphMeta
from schemas.output import PortfolioDecision, PortfolioNewsMarketResult, PortfolioRiskResult, PortfolioTAResult

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


@pytest.mark.asyncio
@patch("api.routes.evaluate.build_risk_input")
@patch("api.routes.evaluate.build_news_market_input")
@patch("api.routes.evaluate.build_ta_input")
@patch("api.routes.evaluate.fetch_market_data_map", new_callable=AsyncMock)
@patch("api.routes.evaluate.evaluator_graph.ainvoke", new_callable=AsyncMock)
async def test_evaluate_endpoint_success(
    mock_ainvoke,
    mock_fetch_market_data_map,
    mock_build_ta_input,
    mock_build_news_market_input,
    mock_build_risk_input,
):
    mock_fetch_market_data_map.return_value = {}
    mock_build_ta_input.return_value = object()
    mock_build_news_market_input.return_value = object()
    mock_build_risk_input.return_value = object()
    mock_ainvoke.return_value = {
        "meta": GraphMeta(
            user_id="user123",
            portfolio_id="user123-portfolio",
            as_of="2026-03-20T10:00:00+07:00",
            symbols=["BTCUSDT"],
        ),
        "final_decision": PortfolioDecision(
            action="Hold",
            confidence=6,
            summary="Portfolio should stay patient.",
            reasoning=["Signals are mixed", "Risk is manageable"],
            portfolio_actions=["Hold current allocations"],
        ),
        "ta_result": PortfolioTAResult(
            portfolio_trend="Neutral",
            signal_strength=5,
            strongest_positions=["BTCUSDT"],
            weakest_positions=[],
            reasons=["Breadth is mixed", "Momentum is average"],
            recommended_action="Hold",
        ),
        "news_market_result": PortfolioNewsMarketResult(
            market_bias="Neutral",
            confidence=5,
            key_catalysts=[],
            portfolio_headwinds=[],
            narrative_summary="No dominant catalyst.",
        ),
        "risk_result": PortfolioRiskResult(
            risk_level="Moderate",
            risk_alerts=["Concentration is acceptable"],
            recommended_constraints=["Keep cash buffer"],
            capital_preservation_bias="Neutral",
        ),
        "error": None,
    }

    payload = {
        "user_id": "user123",
        "portfolio": [{"asset": "BTC", "amount": 0.5, "current_price": 60000.0}],
        "stablecoin_reserve": 10000.0,
    }

    response = client.post("/api/evaluate", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_evaluate_endpoint_validation_error():
    response = client.post("/api/evaluate", json={"user_id": "user123"})
    assert response.status_code == 422
