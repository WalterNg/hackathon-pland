import logging
import json
from typing import Any, AsyncIterator

from fastapi import APIRouter
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse

from trading_agent.graph import trading_agent_graph
from trading_agent.schemas.input import TradingAgentRequest
from trading_agent.schemas.output import TradingAgentEvaluationResponse, WorkflowTraceEvent
from trading_agent.schemas.state import create_trading_agent_state

router = APIRouter()
logger = logging.getLogger("hackathon-pland")


def _merge_stream_state(base: dict[str, Any], delta: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in delta.items():
        if key == "trace" and isinstance(value, list):
            merged[key] = [*merged.get(key, []), *value]
        elif key == "warnings" and isinstance(value, list):
            merged[key] = [*merged.get(key, []), *value]
        else:
            merged[key] = value
    return merged


def _extract_chunk_updates(chunk: dict[str, Any]) -> tuple[list[str], dict[str, Any]]:
    node_names: list[str] = []
    merged_delta: dict[str, Any] = {}

    for key, value in chunk.items():
        if isinstance(value, dict):
            node_names.append(key)
            merged_delta = _merge_stream_state(merged_delta, value)
        else:
            merged_delta = _merge_stream_state(merged_delta, {key: value})

    return node_names, merged_delta


def _build_response_payload(final_state: dict[str, Any], *, status: str) -> TradingAgentEvaluationResponse:
    return TradingAgentEvaluationResponse(
        status=status,
        workflow_version="trading_agent_v1",
        meta=final_state.get("meta").model_dump() if final_state.get("meta") else None,
        final_decision=final_state.get("final_decision"),
        analyst_reports=final_state.get("analyst_reports"),
        investment_debate=final_state.get("investment_debate"),
        portfolio_manager_decision=final_state.get("portfolio_manager_decision"),
        trader_proposal=final_state.get("trader_proposal"),
        risk_debate=final_state.get("risk_debate"),
        trace=final_state.get("trace", []),
        warnings=final_state.get("warnings", []),
        error=final_state.get("error"),
    )


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(jsonable_encoder(data), ensure_ascii=False)}\n\n"


@router.post("/trading-agent/evaluate", response_model=TradingAgentEvaluationResponse)
async def evaluate_trading_agent(payload: TradingAgentRequest) -> TradingAgentEvaluationResponse:
    logger.info("Received trading_agent evaluation request for user: %s", payload.user_id)
    initial_state = create_trading_agent_state(payload)
    final_state = await trading_agent_graph.ainvoke(initial_state)
    return _build_response_payload(final_state, status="error" if final_state.get("error") else "success")


@router.post("/trading-agent/evaluate/stream")
async def stream_trading_agent_evaluation(payload: TradingAgentRequest) -> StreamingResponse:
    logger.info("Received streaming trading_agent evaluation request for user: %s", payload.user_id)
    initial_state = create_trading_agent_state(payload)

    async def event_stream() -> AsyncIterator[str]:
        yield _sse("start", {"status": "started", "workflow_version": "trading_agent_v1"})

        state_snapshot: dict[str, Any] = dict(initial_state)
        try:
            async for chunk in trading_agent_graph.astream(initial_state, stream_mode="updates"):
                if not isinstance(chunk, dict):
                    continue

                node_names, merged_delta = _extract_chunk_updates(chunk)
                state_snapshot = _merge_stream_state(state_snapshot, merged_delta)
                yield _sse(
                    "step",
                    {
                        "nodes": node_names,
                        "state": merged_delta,
                        "trace": [event.model_dump() for event in state_snapshot.get("trace", []) if isinstance(event, WorkflowTraceEvent)],
                        "warnings": state_snapshot.get("warnings", []),
                    },
                )

            final_response = _build_response_payload(state_snapshot, status="error" if state_snapshot.get("error") else "success")
            yield _sse("done", final_response.model_dump())
        except Exception as exc:
            logger.exception("Streaming trading_agent failed")
            yield _sse(
                "error",
                {
                    "status": "error",
                    "message": str(exc),
                },
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
