from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from schemas.input import EvaluationPayload
from schemas.state import AgentState
from schemas.output import TAResult
from agents.ta_agent.agent import run_agent
from services.binance import BinanceService
import logging

router = APIRouter()
logger = logging.getLogger("hackathon-pland")

# Binance: config from settings, reuse one instance
_binance_service = BinanceService()


class TAAnalyzePayload(BaseModel):
    """Request to run TA analysis for a symbol. Klines are fetched via app Binance API."""
    symbol: str = Field(..., description="Binance symbol (e.g. BTCUSDT, ETHUSDT)")


class TAAnalyzeResponse(BaseModel):
    status: str = "success"
    data: dict


@router.post("/ta-agent/analyze", response_model=TAAnalyzeResponse)
async def analyze_ta(payload: TAAnalyzePayload):
    """
    Run TA agent on market data for the given symbol. Fetches klines from Binance (via app),
    computes indicators, and returns trend, signal strength, reasons, and recommended action.
    """
    logger.info("TA analyze request for symbol=%s", payload.symbol)
    try:
        # Fetch market data from Binance
        market_data = await _binance_service.build_market_data(symbol=payload.symbol)
    except Exception as e:
        logger.exception("Failed to build market data from Binance/app")
        raise HTTPException(status_code=502, detail=f"Klines/indicators failed: {str(e)}")

    full_payload = EvaluationPayload(
        user_id="ta-test-user",
        portfolio=[],
        stablecoin_reserve=0.0,
        market_data=market_data,
        news_headlines=[],
        social_dominance=0.0,
    )

    initial_state: AgentState = {
        "payload": full_payload,
        "ta_result": None,
        "sentiment_result": None,
        "risk_result": None,
        "final_decision": None,
        "error": None,
    }

    try:
        final_state = await run_agent(initial_state)
    except Exception as e:
        logger.exception("TA Agent failed")
        raise HTTPException(status_code=500, detail=f"TA Agent failed: {str(e)}")

    if final_state.get("error"):
        return TAAnalyzeResponse(
            status="error",
            data={"message": final_state["error"]},
        )

    ta_result: Optional[TAResult] = final_state.get("ta_result")
    if not ta_result:
        return TAAnalyzeResponse(
            status="error",
            data={"message": "No TA result returned"},
        )

    return TAAnalyzeResponse(
        status="success",
        data={"ta_result": ta_result.model_dump()},
    )
