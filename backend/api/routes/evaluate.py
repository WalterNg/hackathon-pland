import logging
import time

from fastapi import APIRouter, HTTPException

from agents.graph import evaluator_graph
from schemas.input import EvaluationPayload
from schemas.output import EvaluationResponse
from schemas.state import create_agent_state
from services.binance import BinanceService
from services.portfolio_snapshot import (
    build_graph_meta,
    build_news_market_input,
    build_risk_input,
    build_ta_input,
    fetch_market_data_map,
)

router = APIRouter()
logger = logging.getLogger("hackathon-pland")
_binance_service = BinanceService()


@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate_portfolio(payload: EvaluationPayload):
    logger.info("Received evaluation request for user: %s", payload.user_id)

    if not payload.portfolio:
        raise HTTPException(status_code=422, detail="Portfolio must contain at least one asset.")

    try:
        market_data_map = await fetch_market_data_map(payload.portfolio, _binance_service)
        meta = build_graph_meta(payload)
        ta_input = build_ta_input(payload, market_data_map)
        news_market_input = build_news_market_input(payload, ta_input)
        risk_input = build_risk_input(ta_input)
    except Exception as e:
        logger.exception("Failed to prepare portfolio analysis inputs")
        raise HTTPException(status_code=502, detail=f"Portfolio preprocessing failed: {str(e)}")

    initial_state = create_agent_state(
        meta=meta,
        ta_input=ta_input,
        news_market_input=news_market_input,
        risk_input=risk_input,
    )

    try:
        logger.info("Triggering Evaluator Graph for portfolio: %s", meta.portfolio_id)
        start_time = time.perf_counter()
        final_state = await evaluator_graph.ainvoke(initial_state)
        duration = time.perf_counter() - start_time
        logger.info("Evaluation completed for user: %s | Total Time: %.2fs", payload.user_id, duration)

        if final_state.get("error"):
            logger.error("Graph execution error: %s", final_state["error"])
            return EvaluationResponse(status="error", data={"message": final_state["error"]})

        decision = final_state.get("final_decision")
        if not decision:
            return EvaluationResponse(status="error", data={"message": "No decision generated"})

        data = {
            "meta": final_state["meta"].model_dump(),
            "final_decision": decision.model_dump(),
            "components": {
                "ta_result": final_state.get("ta_result").model_dump() if final_state.get("ta_result") else None,
                "news_market_result": final_state.get("news_market_result").model_dump()
                if final_state.get("news_market_result")
                else None,
                "risk_result": final_state.get("risk_result").model_dump() if final_state.get("risk_result") else None,
            },
        }
        return EvaluationResponse(status="success", data=data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("API Error during evaluation: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
