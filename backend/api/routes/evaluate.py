from fastapi import APIRouter, HTTPException
from schemas.input import EvaluationPayload
from schemas.output import EvaluationResponse
from schemas.state import AgentState
from agents.orchestrator import evaluator_graph
import logging

router = APIRouter()
logger = logging.getLogger("hackathon-pland")

@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate_portfolio(payload: EvaluationPayload):
    logger.info(f"Received evaluation request for user: {payload.user_id}")
    
    initial_state = AgentState(
        payload=payload,
        ta_result=None,
        sentiment_result=None,
        risk_result=None,
        final_decision=None,
        error=None
    )
    
    try:
        logger.info(f"Triggering Evaluator Graph for payload: {payload.user_id}")
        final_state = await evaluator_graph.ainvoke(initial_state)
        
        if final_state.get("error"):
            logger.error(f"Graph execution error: {final_state['error']}")
            return EvaluationResponse(
                status="error",
                data={"message": final_state["error"]}
            )
            
        decision = final_state.get("final_decision")
        if not decision:
            return EvaluationResponse(
                status="error",
                data={"message": "No decision generated"}
            )
            
        data = {
            "final_decision": decision.model_dump(),
            "components": {
                "ta_result": final_state.get("ta_result").model_dump() if final_state.get("ta_result") else None
            }
        }
        
        return EvaluationResponse(
            status="success",
            data=data
        )
    except Exception as e:
        logger.error(f"API Error during evaluation: {str(e)}")
        # F5: Return proper HTTP 500 instead of 200 with error status for unexpected exceptions
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
