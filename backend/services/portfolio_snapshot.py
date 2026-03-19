from __future__ import annotations

from datetime import datetime
from typing import Dict, List

from schemas.input import (
    AssetTechnicalSnapshot,
    BenchmarkContext,
    EvaluationPayload,
    GraphMeta,
    MarketRiskContext,
    PortfolioMetrics,
    PortfolioNewsMarketInput,
    PortfolioRiskInput,
    PortfolioTAInput,
    PortfolioTechnicalSummary,
    PositionSnapshot,
    TechnicalRiskSignals,
)
from services.binance import BinanceService


def normalize_symbol(asset: str) -> str:
    """Normalize an asset ticker into a Binance-compatible symbol.

    Ensures the symbol is uppercase and ends with `USDT` (e.g. `BTC` -> `BTCUSDT`,
    `ethusdt` -> `ETHUSDT`).

    Args:
        asset: Raw asset ticker (e.g. `BTC`, `BTCUSDT`, `ethusdt`).

    Returns:
        Normalized symbol string ending with `USDT`.
    """
    asset = asset.upper().strip()
    if asset.endswith("USDT"):
        return asset
    return f"{asset}USDT"


def _classify_obv_trend(obv: float) -> str:
    """Classify On-Balance Volume (OBV) trend direction.

    Args:
        obv: OBV value (or delta/derived value depending on upstream indicator impl).

    Returns:
        One of: `"Up"`, `"Down"`, or `"Flat"`.
    """
    if obv > 0:
        return "Up"
    if obv < 0:
        return "Down"
    return "Flat"


def _classify_ta_trend(rsi: float, ma50_gap_pct: float, rvol: float) -> str:
    """Heuristic trend classifier using TA-derived features.

    Args:
        rsi: Relative Strength Index (typically 0-100).
        ma50_gap_pct: Percentage gap of current price vs. 50-day moving average.
        rvol: Relative volume (e.g. compared to a baseline).

    Returns:
        One of: `"Bullish"`, `"Bearish"`, or `"Neutral"`.
    """
    if ma50_gap_pct > 1 and rsi >= 55 and rvol >= 1:
        return "Bullish"
    if ma50_gap_pct < -1 and rsi <= 45:
        return "Bearish"
    return "Neutral"


def _signal_strength(rsi: float, ma50_gap_pct: float, rvol: float) -> int:
    """Compute a bounded (1-10) signal strength score from TA features.

    The score is a simple weighted heuristic that increases with:
    - Magnitude of the MA50 gap
    - Relative volume
    - RSI reaching overbought/oversold thresholds

    Args:
        rsi: RSI value.
        ma50_gap_pct: MA50 gap percentage.
        rvol: Relative volume.

    Returns:
        Integer score in the range `[1, 10]`.
    """
    score = 5
    score += min(2, int(abs(ma50_gap_pct) / 3))
    if rvol >= 1.5:
        score += 1
    if rsi >= 65 or rsi <= 35:
        score += 1
    return max(1, min(10, score))


def _market_regime(bullish_weight_ratio: float, bearish_weight_ratio: float, weighted_avg_rsi: float) -> str:
    """Determine the overall market regime from portfolio technical signals.

    Args:
        bullish_weight_ratio: Portfolio weight ratio attributed to bullish trends.
        bearish_weight_ratio: Portfolio weight ratio attributed to bearish trends.
        weighted_avg_rsi: Portfolio weighted average RSI.

    Returns:
        One of: `"Risk-on"`, `"Risk-off"`, or `"Neutral"`.
    """
    if bullish_weight_ratio >= 0.6 and weighted_avg_rsi >= 55:
        return "Risk-on"
    if bearish_weight_ratio >= 0.4 or weighted_avg_rsi <= 45:
        return "Risk-off"
    return "Neutral"


def _technical_breadth(bullish_weight_ratio: float, bearish_weight_ratio: float) -> str:
    """Summarize technical breadth using bullish/bearish weight ratios.

    Args:
        bullish_weight_ratio: Portfolio weight ratio attributed to bullish trends.
        bearish_weight_ratio: Portfolio weight ratio attributed to bearish trends.

    Returns:
        One of: `"Broadly Bullish"`, `"Weak"`, or `"Mixed"`.
    """
    if bullish_weight_ratio >= 0.65:
        return "Broadly Bullish"
    if bearish_weight_ratio >= 0.45:
        return "Weak"
    return "Mixed"


async def fetch_market_data_map(
    portfolio: List,
    binance_service: BinanceService,
) -> Dict[str, object]:
    """Fetch market data for each unique portfolio asset symbol.

    For each item in `portfolio`, the asset symbol is normalized, deduplicated,
    and market data is fetched via `binance_service.build_market_data()`.

    Args:
        portfolio: Iterable of portfolio items with an `asset` attribute.
        binance_service: BinanceService instance used to build market data.

    Returns:
        Mapping `symbol -> MarketData` (or an object compatible with expected TA inputs).
    """
    market_data_by_symbol: Dict[str, object] = {}
    for item in portfolio:
        symbol = normalize_symbol(item.asset)
        if symbol in market_data_by_symbol:
            continue
        market_data_by_symbol[symbol] = await binance_service.build_market_data(symbol=symbol)
    return market_data_by_symbol


def build_graph_meta(payload: EvaluationPayload, portfolio_id: str | None = None) -> GraphMeta:
    """Build graph-level metadata for orchestrator execution/logging.

    Args:
        payload: Incoming evaluation request payload.
        portfolio_id: Optional portfolio identifier. If not provided, it is derived
            from `payload.user_id`.

    Returns:
        `GraphMeta` containing user id, portfolio id, timestamp, and normalized symbols.
    """
    symbols = [normalize_symbol(item.asset) for item in payload.portfolio]
    return GraphMeta(
        user_id=payload.user_id,
        portfolio_id=portfolio_id or f"{payload.user_id}-portfolio",
        as_of=datetime.now().astimezone().isoformat(),
        symbols=symbols,
    )


def build_position_snapshots(payload: EvaluationPayload) -> List[PositionSnapshot]:
    """Create weight/value snapshots per position in the portfolio.

    The snapshot weight is computed relative to the total portfolio value:
    sum of `(amount * current_price)` across all positions plus `stablecoin_reserve`.
    If total value is non-positive, a fallback denominator of `1.0` is used to
    avoid division by zero.

    Args:
        payload: EvaluationPayload containing portfolio items and stablecoin reserve.

    Returns:
        List of `PositionSnapshot` objects (one per portfolio position).
    """
    total_assets_value = sum(item.amount * item.current_price for item in payload.portfolio)
    total_value = total_assets_value + payload.stablecoin_reserve
    denominator = total_value if total_value > 0 else 1.0

    snapshots: List[PositionSnapshot] = []
    for item in payload.portfolio:
        value_usd = item.amount * item.current_price
        snapshots.append(
            PositionSnapshot(
                symbol=normalize_symbol(item.asset),
                weight=value_usd / denominator,
                quantity=item.amount,
                current_price=item.current_price,
                value_usd=value_usd,
            )
        )
    return snapshots


def build_ta_input(
    payload: EvaluationPayload,
    market_data_by_symbol: Dict[str, object],
) -> PortfolioTAInput:
    """Build the technical-analysis (TA) input object for the evaluation graph.

    This function:
    - Computes position snapshots and portfolio cash ratio.
    - Converts market data per symbol into per-asset technical signals.
    - Aggregates weighted portfolio summaries such as breadth and market regime inputs.

    Args:
        payload: Incoming evaluation payload.
        market_data_by_symbol: Mapping `symbol -> MarketData` fetched externally
            (typically by `fetch_market_data_map`).

    Returns:
        A fully populated `PortfolioTAInput`.
    """
    positions = build_position_snapshots(payload)
    total_assets_value = sum(p.value_usd for p in positions)
    total_value = total_assets_value + payload.stablecoin_reserve
    cash_ratio = payload.stablecoin_reserve / total_value if total_value > 0 else 0.0

    per_asset_signals: List[AssetTechnicalSnapshot] = []
    bullish_weight_ratio = 0.0
    bearish_weight_ratio = 0.0
    above_ma50_weight_ratio = 0.0
    high_rvol_weight_ratio = 0.0
    weighted_rsi_sum = 0.0
    invested_weight = sum(position.weight for position in positions) or 1.0

    for position in positions:
        md = market_data_by_symbol[position.symbol]
        ma50_gap_pct = ((position.current_price - md.ma50) / md.ma50 * 100.0) if md.ma50 else 0.0
        trend = _classify_ta_trend(md.rsi, ma50_gap_pct, md.rvol)
        signal_strength = _signal_strength(md.rsi, ma50_gap_pct, md.rvol)
        obv_trend = _classify_obv_trend(md.obv)

        if trend == "Bullish":
            bullish_weight_ratio += position.weight
        elif trend == "Bearish":
            bearish_weight_ratio += position.weight

        if ma50_gap_pct > 0:
            above_ma50_weight_ratio += position.weight
        if md.rvol >= 1.2:
            high_rvol_weight_ratio += position.weight

        weighted_rsi_sum += md.rsi * position.weight

        per_asset_signals.append(
            AssetTechnicalSnapshot(
                symbol=position.symbol,
                rsi=md.rsi,
                ma50_gap_pct=round(ma50_gap_pct, 2),
                bollinger_position=md.bollinger_bands,
                rvol=round(md.rvol, 2),
                obv_trend=obv_trend,
                trend=trend,
                signal_strength=signal_strength,
            )
        )

    weighted_avg_rsi = min(100.0, max(0.0, weighted_rsi_sum / invested_weight))
    technical_summary = PortfolioTechnicalSummary(
        weighted_avg_rsi=round(weighted_avg_rsi, 2),
        bullish_weight_ratio=round(min(1.0, bullish_weight_ratio), 4),
        bearish_weight_ratio=round(min(1.0, bearish_weight_ratio), 4),
        above_ma50_weight_ratio=round(min(1.0, above_ma50_weight_ratio), 4),
        high_rvol_weight_ratio=round(min(1.0, high_rvol_weight_ratio), 4),
        technical_breadth=_technical_breadth(bullish_weight_ratio, bearish_weight_ratio),
    )
    benchmark_context = BenchmarkContext(
        primary_symbol=positions[0].symbol if positions else None,
        primary_trend=per_asset_signals[0].trend if per_asset_signals else "Neutral",
        market_regime=_market_regime(
            technical_summary.bullish_weight_ratio,
            technical_summary.bearish_weight_ratio,
            technical_summary.weighted_avg_rsi,
        ),
    )

    return PortfolioTAInput(
        cash_ratio=round(cash_ratio, 4),
        positions=positions,
        per_asset_signals=per_asset_signals,
        portfolio_technical_summary=technical_summary,
        benchmark_context=benchmark_context,
    )


def build_news_market_input(
    payload: EvaluationPayload,
    ta_input: PortfolioTAInput,
) -> PortfolioNewsMarketInput:
    """Build the news and market narrative input for the sentiment/risk pipeline.

    It chooses a `dominant_narrative` based on:
    1) The first headline if headlines are provided.
    2) Otherwise, the TA-derived `market_regime`.

    Args:
        payload: EvaluationPayload containing optional news headlines and social dominance.
        ta_input: PortfolioTAInput produced by TA preprocessing.

    Returns:
        PortfolioNewsMarketInput to feed downstream sentiment processing.
    """
    market_regime = ta_input.benchmark_context.market_regime
    if payload.news_headlines:
        dominant_narrative = payload.news_headlines[0]
    elif market_regime == "Risk-on":
        dominant_narrative = "Market momentum remains constructive across the portfolio."
    elif market_regime == "Risk-off":
        dominant_narrative = "Portfolio is exposed to a defensive and cautious market backdrop."
    else:
        dominant_narrative = "Market signals are mixed and lack a dominant catalyst."

    return PortfolioNewsMarketInput(
        portfolio_symbols=[position.symbol for position in ta_input.positions],
        news_headlines=payload.news_headlines,
        social_sentiment_score=payload.social_dominance,
        dominant_narrative=dominant_narrative,
        macro_context={"market_regime": market_regime},
    )


def build_risk_input(ta_input: PortfolioTAInput) -> PortfolioRiskInput:
    """Build the risk input object for the risk agent.

    Args:
        ta_input: PortfolioTAInput including per-asset signals and portfolio summaries.

    Returns:
        PortfolioRiskInput with portfolio metrics (concentration, volatility estimate)
        and technical risk signals.
    """
    positions = ta_input.positions
    sorted_weights = sorted((position.weight for position in positions), reverse=True)
    top1_weight = sorted_weights[0] if sorted_weights else 0.0
    top2_weight = sum(sorted_weights[:2]) if sorted_weights else 0.0

    estimated_volatility = round(
        sum(position.weight * signal.rvol for position, signal in zip(positions, ta_input.per_asset_signals)),
        4,
    )

    weak_trend_concentration = round(
        sum(
            position.weight
            for position, signal in zip(positions, ta_input.per_asset_signals)
            if signal.trend != "Bullish"
        ),
        4,
    )

    return PortfolioRiskInput(
        cash_ratio=ta_input.cash_ratio,
        positions=positions,
        portfolio_metrics=PortfolioMetrics(
            asset_count=len(positions),
            top1_weight=round(top1_weight, 4),
            top2_weight=round(top2_weight, 4),
            concentration_score=round(top1_weight * 0.6 + top2_weight * 0.4, 4),
            estimated_volatility=estimated_volatility,
        ),
        technical_risk_signals=TechnicalRiskSignals(
            bearish_weight_ratio=ta_input.portfolio_technical_summary.bearish_weight_ratio,
            weak_trend_concentration=weak_trend_concentration,
            high_rvol_weight_ratio=ta_input.portfolio_technical_summary.high_rvol_weight_ratio,
        ),
        market_risk_context=MarketRiskContext(
            market_regime=ta_input.benchmark_context.market_regime,
            liquidity_condition="Normal",
        ),
    )
