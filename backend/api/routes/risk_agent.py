from typing import Literal, Optional, Union

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from agents.risk_agent.agent import run_agent
from schemas.input import EvaluationPayload, PortfolioItem
from schemas.output import PortfolioRiskResult
from schemas.state import create_agent_state
from services.binance import BinanceService
from services.portfolio_snapshot import build_graph_meta, build_risk_input, build_ta_input, fetch_market_data_map

router = APIRouter()
logger = logging.getLogger("hackathon-pland")
_binance_service = BinanceService()


class RiskAnalyzePayload(BaseModel):
    user_id: str = Field(default="risk-test-user")
    portfolio: list[PortfolioItem]
    stablecoin_reserve: float = Field(default=0.0, ge=0)


class ErrorPayload(BaseModel):
    message: str


class RiskAnalyzeResponse(BaseModel):
    status: Literal["success", "error"]
    data: Union[PortfolioRiskResult, ErrorPayload]


@router.post("/risk-agent/analyze", response_model=RiskAnalyzeResponse)
async def analyze_risk(payload: RiskAnalyzePayload) -> RiskAnalyzeResponse:
    logger.info("Risk analyze request")
    if not payload.portfolio:
        raise HTTPException(status_code=422, detail="Portfolio must contain at least one asset.")

    eval_payload = EvaluationPayload(
        user_id=payload.user_id,
        portfolio=payload.portfolio,
        stablecoin_reserve=payload.stablecoin_reserve,
        news_headlines=[],
        social_dominance=0.0,
    )

    try:
        market_data_map = await fetch_market_data_map(eval_payload.portfolio, _binance_service)
        meta = build_graph_meta(eval_payload, portfolio_id=f"{payload.user_id}-risk-only")
        ta_input = build_ta_input(eval_payload, market_data_map)
        risk_input = build_risk_input(ta_input)
        initial_state = create_agent_state(meta=meta, risk_input=risk_input)
    except Exception as e:
        logger.exception("Failed to prepare Risk input")
        raise HTTPException(status_code=502, detail=f"Risk preprocessing failed: {str(e)}")

    try:
        final_state = await run_agent(initial_state)
    except Exception as e:
        logger.exception("Risk Agent failed")
        raise HTTPException(status_code=500, detail=f"Risk Agent failed: {str(e)}")

    if final_state.get("error"):
        return RiskAnalyzeResponse(status="error", data=ErrorPayload(message=final_state["error"]))

    risk_result: Optional[PortfolioRiskResult] = final_state.get("risk_result")
    if not risk_result:
        return RiskAnalyzeResponse(status="error", data=ErrorPayload(message="No risk result returned"))

    return RiskAnalyzeResponse(status="success", data=risk_result)
