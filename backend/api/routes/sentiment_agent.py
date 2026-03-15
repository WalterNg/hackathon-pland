from typing import Union, Literal, Optional

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from schemas.input import EvaluationPayload, MarketData
from schemas.state import AgentState
from schemas.output import SentimentResult
from agents.sentiment_agent.agent import analyze_sentiment
from services.news_rss import fetch_crypto_news_from_rss
from services.sentiment_sources import fetch_fear_greed_index


router = APIRouter()
logger = logging.getLogger("hackathon-pland")


class SentimentAnalyzePayload(BaseModel):
    """
    Empty payload – backend always fetches news & sentiment sources itself.
    """
    pass


class ErrorPayload(BaseModel):
    message: str


class SentimentAnalyzeResponse(BaseModel):
    status: Literal["success", "error"]
    data: Union[SentimentResult, ErrorPayload]


@router.post("/sentiment-agent/analyze", response_model=SentimentAnalyzeResponse)
async def analyze_sentiment_api(payload: SentimentAnalyzePayload) -> SentimentAnalyzeResponse:  # payload kept for future extensibility
    """
    Run the Sentiment Agent standalone.

    - If news_headlines is not provided, fetch recent crypto news via RSS.
    - If social_dominance is not provided, fetch Fear & Greed Index.
    """
    logger.info("Sentiment analyze request")

    # 1) Build sentiment inputs (news + social) – always from backend sources
    try:
        articles = fetch_crypto_news_from_rss(limit_per_feed=5)
        headlines = [a["title"] for a in articles]
    except Exception:
        logger.exception("Failed to fetch crypto news from RSS")
        headlines = []

    social = await fetch_fear_greed_index()
    if social is None:
        logger.warning("Fear & Greed Index fetch failed, defaulting to 50 (Neutral)")
        social = 50.0

    # 2) Build minimal EvaluationPayload (SentimentAgent only cares about news_headlines + social_dominance)
    dummy_market_data = MarketData(
        rvol=1.0,
        ma50=1.0,
        rsi=50.0,
        bollinger_bands="middle",
        obv=0.0,
    )

    eval_payload = EvaluationPayload(
        user_id="sentiment-test-user",
        portfolio=[],
        stablecoin_reserve=0.0,
        market_data=dummy_market_data,
        news_headlines=headlines,
        social_dominance=social,
    )

    initial_state: AgentState = {
        "payload": eval_payload,
        "ta_result": None,
        "sentiment_result": None,
        "risk_result": None,
        "final_decision": None,
        "error": None,
    }

    try:
        final_state = await analyze_sentiment(initial_state)
    except Exception as e:
        logger.exception("Sentiment Agent failed")
        raise HTTPException(status_code=500, detail=f"Sentiment Agent failed: {str(e)}")

    if final_state.get("error"):
        return SentimentAnalyzeResponse(
            status="error",
            data=ErrorPayload(message=final_state["error"]),
        )

    sentiment: Optional[SentimentResult] = final_state.get("sentiment_result")
    if not sentiment:
        return SentimentAnalyzeResponse(
            status="error",
            data=ErrorPayload(message="No sentiment result returned"),
        )

    return SentimentAnalyzeResponse(
        status="success",
        data=sentiment,
    )

