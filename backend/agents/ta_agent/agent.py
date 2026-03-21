import logging

from core.base_agent import AgentError, BaseAgent
from schemas.output import PortfolioTAResult
from schemas.state import AgentState

from .prompts import TA_SYSTEM_PROMPT

logger = logging.getLogger("TA_AGENT")


class TAAgent(BaseAgent):
    """Analyzes portfolio-level technical posture."""

    def _build_input(self, state: AgentState) -> str:
        ta_input = state.get("ta_input")
        if not ta_input:
            raise AgentError("TA input missing from state - cannot analyze portfolio technicals.")

        positions_text = "\n".join(
            f"  - {position.symbol}: weight={position.weight:.2%}, value=${position.value_usd:.2f}"
            for position in ta_input.positions
        )
        signals_text = "\n".join(
            (
                f"  - {signal.symbol}: trend={signal.trend}, strength={signal.signal_strength}/10, "
                f"RSI={signal.rsi}, MA50 gap={signal.ma50_gap_pct}%, RVOL={signal.rvol}, "
                f"Bollinger={signal.bollinger_position}, OBV trend={signal.obv_trend}"
            )
            for signal in ta_input.per_asset_signals
        )
        summary = ta_input.portfolio_technical_summary

        return (
            "Analyze the following portfolio-level technical snapshot.\n"
            f"Cash Ratio: {ta_input.cash_ratio:.2%}\n"
            f"Benchmark Context: primary={ta_input.benchmark_context.primary_symbol}, "
            f"primary_trend={ta_input.benchmark_context.primary_trend}, "
            f"market_regime={ta_input.benchmark_context.market_regime}\n"
            f"Positions:\n{positions_text}\n"
            f"Per-Asset Technical Signals:\n{signals_text}\n"
            "Portfolio Technical Summary:\n"
            f"  Weighted Avg RSI: {summary.weighted_avg_rsi}\n"
            f"  Bullish Weight Ratio: {summary.bullish_weight_ratio:.2%}\n"
            f"  Bearish Weight Ratio: {summary.bearish_weight_ratio:.2%}\n"
            f"  Above MA50 Weight Ratio: {summary.above_ma50_weight_ratio:.2%}\n"
            f"  High RVOL Weight Ratio: {summary.high_rvol_weight_ratio:.2%}\n"
            f"  Technical Breadth: {summary.technical_breadth}"
        )

    async def run_node(self, state: AgentState) -> AgentState:
        logger.info("Executing TA Agent.")
        try:
            result: PortfolioTAResult = await self.run(TA_SYSTEM_PROMPT, self._build_input(state), PortfolioTAResult)
            return {"ta_result": result}
        except AgentError as e:
            logger.error(str(e))
            return {"error": f"TA Agent failed: {e}"}


_agent = TAAgent()


async def run_agent(state: AgentState) -> AgentState:
    return await _agent.run_node(state)
