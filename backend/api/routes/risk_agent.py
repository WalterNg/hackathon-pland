from typing import Union, Literal, Optional

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from schemas.input import EvaluationPayload, MarketData
from schemas.state import AgentState
from schemas.output import RiskResult
from agents.risk_agent.agent import run_agent


router = APIRouter()
logger = logging.getLogger("hackathon-pland")


class RiskAnalyzePayload(BaseModel):
    """
    Empty payload - backend constructs EvaluationPayload internally for the Risk Agent.
    """

    pass


class ErrorPayload(BaseModel):
    message: str


class RiskAnalyzeResponse(BaseModel):
    status: Literal["success", "error"]
    data: Union[RiskResult, ErrorPayload]


@router.post("/risk-agent/analyze", response_model=RiskAnalyzeResponse)
async def analyze_risk(payload: RiskAnalyzePayload) -> RiskAnalyzeResponse:
    """
    Run the Risk Agent standalone.

    Backend builds a minimal EvaluationPayload; client does not provide raw TA/Sentiment/portfolio data.
    """
    logger.info("Risk analyze request")

    # Build dummy EvaluationPayload
    dummy_market_data = MarketData(
        rvol=1.0,
        ma50=1.0,
        rsi=50.0,
        bollinger_bands="middle",
        obv=0.0,
    )

    eval_payload = EvaluationPayload(
        user_id="risk-test-user",
        portfolio=[],
        stablecoin_reserve=0.0,
        market_data=dummy_market_data,
        news_headlines=[],
        social_dominance=0.0,
    )

    # Build initial AgentState
    initial_state: AgentState = {
        "payload": eval_payload,
        "ta_result": None,
        "sentiment_result": None,
        "risk_result": None,
        "final_decision": None,
        "error": None,
    }

    # Call Risk Agent node
    try:
        final_state = await run_agent(initial_state)
    except Exception as e:
        logger.exception("Risk Agent failed")
        raise HTTPException(status_code=500, detail=f"Risk Agent failed: {str(e)}")

    # 4) Normalize errors and missing result to unified response
    if final_state.get("error"):
        return RiskAnalyzeResponse(
            status="error",
            data=ErrorPayload(message=final_state["error"]),
        )

    risk_result: Optional[RiskResult] = final_state.get("risk_result")
    if not risk_result:
        return RiskAnalyzeResponse(
            status="error",
            data=ErrorPayload(message="No risk result returned"),
        )

    return RiskAnalyzeResponse(
        status="success",
        data=risk_result,
    )

