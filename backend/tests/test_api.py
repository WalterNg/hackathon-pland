from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from schemas.input import GraphMeta
from schemas.output import (
    BinanceConnectedPosition,
    BinanceConnectionAccountInfo,
    BinanceConnectionAsset,
    BinanceConnectionPreviewData,
    BinanceConnectionTotals,
    BinanceConnectionWarning,
    PortfolioDecision,
    PortfolioNewsMarketResult,
    PortfolioRiskResult,
    PortfolioTAResult,
)

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


@patch("api.routes.binance_connection._binance_connector.build_connection_preview", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_binance_connection_preview_success(mock_build_connection_preview):
    mock_build_connection_preview.return_value = BinanceConnectionPreviewData(
        mode="demo",
        account=BinanceConnectionAccountInfo(
            account_type="SPOT",
            can_trade=True,
            can_withdraw=False,
            can_deposit=True,
            update_time=1710000000000,
        ),
        assets=[
            BinanceConnectionAsset(
                asset="BTC",
                free=0.42,
                locked=0.0,
                quantity=0.42,
                price_usd=71000.0,
                estimated_usd=29820.0,
                is_stablecoin=False,
            )
        ],
        totals=BinanceConnectionTotals(
            asset_count=1,
            non_zero_asset_count=1,
            total_estimated_usd=29820.0,
        ),
        warnings=[
            BinanceConnectionWarning(
                code="price_unavailable",
                message="Price unavailable for BTC.",
                severity="warning",
            )
        ],
    )

    response = client.post(
        "/api/binance/connection/preview",
        json={
            "mode": "demo",
            "api_key": "demo-key",
            "api_secret": "demo-secret",
            "include_zero_balances": False,
            "recv_window_ms": 5000,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["data"]["totals"]["total_estimated_usd"] == 29820.0
    mock_build_connection_preview.assert_awaited_once()


@patch("api.routes.binance_connection._binance_connector.build_connection_preview", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_binance_connection_preview_error(mock_build_connection_preview):
    from services.binance_connector import BinanceConnectorError

    mock_build_connection_preview.side_effect = BinanceConnectorError("Connector failed", status_code=400)

    response = client.post(
        "/api/binance/connection/preview",
        json={
            "mode": "testnet",
            "api_key": "test-key",
            "api_secret": "test-secret",
            "include_zero_balances": False,
            "recv_window_ms": 5000,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Connector failed"


@patch("api.routes.binance_connection._binance_connector.build_connected_positions", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_binance_connected_positions_success(mock_build_connected_positions):
    mock_build_connected_positions.return_value = [
        BinanceConnectedPosition(symbol="BTCUSDT", quantity=0.42, avg_buy_price_usd=71000.0)
    ]

    response = client.post(
        "/api/binance/connection/positions",
        json={
            "mode": "demo",
            "api_key": "demo-key",
            "api_secret": "demo-secret",
            "include_zero_balances": False,
            "recv_window_ms": 5000,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["data"][0]["symbol"] == "BTCUSDT"
    mock_build_connected_positions.assert_awaited_once()
