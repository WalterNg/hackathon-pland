import logging

from schemas.input import EvaluationPayload
from services.binance import BinanceService
from services.news_rss import fetch_crypto_news_from_rss
from services.portfolio_snapshot import (
    build_graph_meta,
    build_news_market_input,
    build_risk_input,
    build_ta_input,
    fetch_market_data_map,
)
from services.sentiment_sources import fetch_fear_greed_index
from trading_agent.schemas.input import (
    AssetTechnicalSnapshot,
    BenchmarkContext,
    NewsContext,
    PortfolioContext,
    PortfolioStructureContext,
    PortfolioTechnicalSummary,
    PositionSnapshot,
    SentimentContext,
    TechnicalContext,
    TradingAgentMeta,
    TradingAgentRequest,
)

logger = logging.getLogger("TRADING_AGENT.PREPARE")
_binance_service = BinanceService()


def _sentiment_label(score: float) -> str:
    if score >= 60:
        return "Bullish"
    if score <= 40:
        return "Bearish"
    return "Neutral"


async def build_trading_context(request: TradingAgentRequest) -> tuple[TradingAgentMeta, PortfolioContext, list[str]]:
    warnings: list[str] = []
    headlines = list(request.news_headlines)

    if not headlines:
        try:
            headlines = [article["title"] for article in fetch_crypto_news_from_rss(limit_per_feed=4)]
        except Exception:
            logger.exception("Failed to fetch RSS headlines for trading_agent")
            warnings.append("Unable to fetch RSS headlines; using neutral external-news context.")
            headlines = []

    social_score = request.social_dominance
    if social_score == 0:
        fetched_score = await fetch_fear_greed_index()
        if fetched_score is None:
            warnings.append("Fear & Greed Index unavailable; defaulting to neutral sentiment score 50.")
            social_score = 50.0
        else:
            social_score = fetched_score

    base_payload = EvaluationPayload(
        user_id=request.user_id,
        portfolio=[item.model_dump() for item in request.portfolio],
        stablecoin_reserve=request.stablecoin_reserve,
        news_headlines=headlines,
        social_dominance=social_score,
    )

    market_data_map = await fetch_market_data_map(base_payload.portfolio, _binance_service)
    meta = build_graph_meta(base_payload, portfolio_id=f"{request.user_id}-trading-agent")
    ta_input = build_ta_input(base_payload, market_data_map)
    news_input = build_news_market_input(base_payload, ta_input)
    risk_input = build_risk_input(ta_input)

    trading_meta = TradingAgentMeta(
        user_id=meta.user_id,
        portfolio_id=meta.portfolio_id,
        as_of=meta.as_of,
        symbols=meta.symbols,
    )

    context = PortfolioContext(
        technical=TechnicalContext(
            cash_ratio=ta_input.cash_ratio,
            positions=[PositionSnapshot(**position.model_dump()) for position in ta_input.positions],
            per_asset_signals=[AssetTechnicalSnapshot(**signal.model_dump()) for signal in ta_input.per_asset_signals],
            portfolio_technical_summary=PortfolioTechnicalSummary(**ta_input.portfolio_technical_summary.model_dump()),
            benchmark_context=BenchmarkContext(**ta_input.benchmark_context.model_dump()),
        ),
        news=NewsContext(
            portfolio_symbols=list(news_input.portfolio_symbols),
            news_headlines=list(news_input.news_headlines),
            dominant_narrative=news_input.dominant_narrative,
            macro_context=dict(news_input.macro_context),
        ),
        sentiment=SentimentContext(
            social_sentiment_score=news_input.social_sentiment_score,
            dominant_narrative=news_input.dominant_narrative,
            sentiment_label=_sentiment_label(news_input.social_sentiment_score),
        ),
        structure=PortfolioStructureContext(
            cash_ratio=risk_input.cash_ratio,
            positions=[PositionSnapshot(**position.model_dump()) for position in risk_input.positions],
            top1_weight=risk_input.portfolio_metrics.top1_weight,
            top2_weight=risk_input.portfolio_metrics.top2_weight,
            concentration_score=risk_input.portfolio_metrics.concentration_score,
            estimated_volatility=risk_input.portfolio_metrics.estimated_volatility,
            liquidity_condition=risk_input.market_risk_context.liquidity_condition,
        ),
    )

    return trading_meta, context, warnings

