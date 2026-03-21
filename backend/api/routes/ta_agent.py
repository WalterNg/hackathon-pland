import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from agents.ta_agent.agent import run_agent
from schemas.input import EvaluationPayload, PortfolioItem
from schemas.output import PortfolioTAResult
from schemas.state import create_agent_state
from services.binance import BinanceService
from services.portfolio_snapshot import build_graph_meta, build_ta_input, fetch_market_data_map

router = APIRouter()
logger = logging.getLogger("hackathon-pland")
_binance_service = BinanceService()


class TAAnalyzePayload(BaseModel):
    """Run the TA agent at portfolio level."""

    user_id: str = Field(default="ta-test-user")
    portfolio: list[PortfolioItem]
    stablecoin_reserve: float = Field(default=0.0, ge=0)


class TAAnalyzeResponse(BaseModel):
    status: str = "success"
    data: dict


@router.post("/ta-agent/analyze", response_model=TAAnalyzeResponse)
async def analyze_ta(payload: TAAnalyzePayload):
    logger.info("TA analyze request for %s portfolio positions", len(payload.portfolio))
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
        meta = build_graph_meta(eval_payload, portfolio_id=f"{payload.user_id}-ta-only")
        ta_input = build_ta_input(eval_payload, market_data_map)
        initial_state = create_agent_state(meta=meta, ta_input=ta_input)
    except Exception as e:
        logger.exception("Failed to prepare TA input")
        raise HTTPException(status_code=502, detail=f"TA preprocessing failed: {str(e)}")

    try:
        final_state = await run_agent(initial_state)
    except Exception as e:
        logger.exception("TA Agent failed")
        raise HTTPException(status_code=500, detail=f"TA Agent failed: {str(e)}")

    if final_state.get("error"):
        return TAAnalyzeResponse(status="error", data={"message": final_state["error"]})

    ta_result: Optional[PortfolioTAResult] = final_state.get("ta_result")
    if not ta_result:
        return TAAnalyzeResponse(status="error", data={"message": "No TA result returned"})

    return TAAnalyzeResponse(
        status="success",
        data={
            "meta": meta.model_dump(),
            "ta_result": ta_result.model_dump(),
        },
    )
