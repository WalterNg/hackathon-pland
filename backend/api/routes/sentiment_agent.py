from typing import Literal, Optional, Union

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from agents.sentiment_agent.agent import run_agent
from schemas.input import EvaluationPayload, PortfolioItem, PortfolioNewsMarketInput
from schemas.output import PortfolioNewsMarketResult
from schemas.state import create_agent_state
from services.portfolio_snapshot import build_graph_meta, normalize_symbol
from services.news_rss import fetch_crypto_news_from_rss
from services.sentiment_sources import fetch_fear_greed_index

router = APIRouter()
logger = logging.getLogger("hackathon-pland")


class SentimentAnalyzePayload(BaseModel):
    user_id: str = Field(default="news-market-test-user")
    portfolio: list[PortfolioItem] = Field(default_factory=list)


class ErrorPayload(BaseModel):
    message: str


class SentimentAnalyzeResponse(BaseModel):
    status: Literal["success", "error"]
    data: Union[PortfolioNewsMarketResult, ErrorPayload]


@router.post("/sentiment-agent/analyze", response_model=SentimentAnalyzeResponse)
async def analyze_sentiment_api(payload: SentimentAnalyzePayload) -> SentimentAnalyzeResponse:
    logger.info("News market analyze request")

    try:
        articles = fetch_crypto_news_from_rss(limit_per_feed=5)
        headlines = [article["title"] for article in articles]
    except Exception:
        logger.exception("Failed to fetch crypto news from RSS")
        headlines = []

    social = await fetch_fear_greed_index()
    if social is None:
        logger.warning("Fear & Greed Index fetch failed, defaulting to 50 (Neutral)")
        social = 50.0

    eval_payload = EvaluationPayload(
        user_id=payload.user_id,
        portfolio=payload.portfolio,
        stablecoin_reserve=0.0,
        news_headlines=headlines,
        social_dominance=social,
    )

    meta = build_graph_meta(eval_payload, portfolio_id=f"{payload.user_id}-news-only")
    news_market_input = PortfolioNewsMarketInput(
        portfolio_symbols=[normalize_symbol(item.asset) for item in payload.portfolio],
        news_headlines=headlines,
        social_sentiment_score=social,
        dominant_narrative=headlines[0] if headlines else "Market context is neutral due to limited external information.",
        macro_context={"market_regime": "Neutral"},
    )

    initial_state = create_agent_state(meta=meta, news_market_input=news_market_input)

    try:
        final_state = await run_agent(initial_state)
    except Exception as e:
        logger.exception("News Market Agent failed")
        raise HTTPException(status_code=500, detail=f"News Market Agent failed: {str(e)}")

    if final_state.get("error"):
        return SentimentAnalyzeResponse(status="error", data=ErrorPayload(message=final_state["error"]))

    result: Optional[PortfolioNewsMarketResult] = final_state.get("news_market_result")
    if not result:
        return SentimentAnalyzeResponse(status="error", data=ErrorPayload(message="No news market result returned"))

    return SentimentAnalyzeResponse(status="success", data=result)
