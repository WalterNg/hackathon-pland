from typing import TypedDict, Optional, Annotated
from .input import EvaluationPayload
from .output import TAResult, SentimentResult, RiskResult, FinalDecision

def merge_errors(left: Optional[str], right: Optional[str]) -> Optional[str]:
    """Reducer to handle concurrent updates to the error field."""
    if right:
        return right
    return left

class AgentState(TypedDict):
    payload: EvaluationPayload
    ta_result: Optional[TAResult]
    sentiment_result: Optional[SentimentResult]
    risk_result: Optional[RiskResult]
    final_decision: Optional[FinalDecision]
    error: Annotated[Optional[str], merge_errors]
