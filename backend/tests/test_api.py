from fastapi.testclient import TestClient
from main import app
from unittest.mock import patch, AsyncMock
from schemas.output import FinalDecision, TAResult

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

import pytest

@pytest.mark.asyncio
@patch("api.routes.evaluate.evaluator_graph.ainvoke", new_callable=AsyncMock)
async def test_evaluate_endpoint_success(mock_ainvoke):
    # Mock the return value of the graph
    mock_ainvoke.return_value = {
        "final_decision": FinalDecision(action="Hold", reasoning="Test reason"),
        "ta_result": TAResult(trend="Neutral", signal_strength=5, reasons=["A", "B"], recommended_action="Hold"),
        "error": None
    }
    
    payload = {
        "user_id": "user123",
        "portfolio": [
            {"asset": "BTC", "amount": 0.5, "current_price": 60000.0}
        ],
        "stablecoin_reserve": 10000.0,
        "market_data": {
            "rvol": 1.5,
            "ma50": 58000.0,
            "rsi": 65.0,
            "bollinger_bands": "Upper",
            "obv": 1500000.0
        }
    }
    
    response = client.post("/api/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "data" in data

def test_evaluate_endpoint_validation_error():
    payload = {
        "user_id": "user123"
        # missing required fields
    }
    
    response = client.post("/api/evaluate", json=payload)
    assert response.status_code == 422
    assert response.json()["status"] == "error"
