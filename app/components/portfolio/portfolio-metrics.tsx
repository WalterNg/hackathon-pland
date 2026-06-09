import { useState } from "react";
import type { PortfolioMetrics as PortfolioMetricsType } from "@/app/lib/portfolio-types";
import { getRiskScoreBand } from "@/app/lib/risk-calculator";
import { MaterialIcon } from "../dashboard/material-icon";
import { MetricCard } from "./metric-card";
import { DrawdownRecovery } from "./drawdown-recovery";

type PortfolioMetricsProps = {
  metrics: PortfolioMetricsType;
};

const symbolNames: Record<string, string> = {
  BTCUSDT: "Bitcoin",
  ETHUSDT: "Ethereum",
  BNBUSDT: "BNB",
  SOLUSDT: "Solana",
  DOGEUSDT: "Dogecoin",
  XRPUSDT: "XRP",
  NEOUSDT: "NEO",
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const usdCompactFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const dateShortFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatSymbol(symbol: string): string {
  const ticker = symbol.replace("USDT", "");
  return symbolNames[symbol] ?? ticker;
}

function getSharpeQuality(sharpe: number | null | undefined): { label: string; colorClass: string } {
  if (sharpe === null || sharpe === undefined) {
    return { label: "—", colorClass: "text-muted" };
  }
  if (sharpe >= 2.0) return { label: "Strong", colorClass: "text-success" };
  if (sharpe >= 1.0) return { label: "Good",   colorClass: "text-success" };
  if (sharpe >= 0.0) return { label: "Weak",   colorClass: "text-warning" };
  return                    { label: "Poor",   colorClass: "text-danger"  };
}

function getRatioQuality(val: number | null | undefined): { label: string; colorClass: string } {
  if (val === null || val === undefined) {
    return { label: "—", colorClass: "text-muted" };
  }
  if (val >= 2.0) return { label: "Strong", colorClass: "text-success" };
  if (val >= 1.0) return { label: "Good",   colorClass: "text-success" };
  if (val >= 0.0) return { label: "Weak",   colorClass: "text-warning" };
  return                    { label: "Poor",   colorClass: "text-danger"  };
}

function getConcentrationLabel(hhi: number): { label: string; colorClass: string } {
  if (hhi >= 4000) return { label: "Very Concentrated", colorClass: "text-danger" };
  if (hhi >= 2000) return { label: "Moderately Concentrated", colorClass: "text-warning" };
  return { label: "Well Diversified", colorClass: "text-success" };
}

function getVolatilityRiskBand(pct: number): { label: string; colorClass: string } {
  if (pct <= 40) return { label: "Low", colorClass: "text-success" };
  if (pct <= 70) return { label: "Moderate", colorClass: "text-warning" };
  if (pct <= 90) return { label: "High", colorClass: "text-orange-300" };
  if (pct <= 97) return { label: "Very High", colorClass: "text-danger" };
  return { label: "Extreme", colorClass: "text-danger font-bold" };
}

function getBetaLabel(beta: number | null | undefined): { label: string; colorClass: string } {
  if (beta === null || beta === undefined) {
    return { label: "—", colorClass: "text-muted" };
  }
  if (beta < 0) return { label: "Inverse Correlation", colorClass: "text-indigo-400" };
  if (beta < 0.5) return { label: "Low Sensitivity", colorClass: "text-success" };
  if (beta < 1.0) return { label: "Moderate Sensitivity", colorClass: "text-success" };
  if (beta === 1.0) return { label: "Market Lockstep", colorClass: "text-success" };
  if (beta <= 1.5) return { label: "High Sensitivity", colorClass: "text-warning" };
  return { label: "Extreme Sensitivity", colorClass: "text-danger" };
}

function getOrdinalSuffix(num: number): string {
  const rounded = Math.round(num);
  const j = rounded % 10;
  const k = rounded % 100;
  if (j === 1 && k !== 11) return `${rounded}st`;
  if (j === 2 && k !== 12) return `${rounded}nd`;
  if (j === 3 && k !== 13) return `${rounded}rd`;
  return `${rounded}th`;
}

function formatAbsolutePnl(pnlUsd: number): string {
  const absPnl = Math.abs(pnlUsd);
  const sign = pnlUsd >= 0 ? "+" : "-";
  return sign + usdFormatter.format(absPnl);
}

export function PortfolioMetrics({ metrics }: PortfolioMetricsProps) {
  const [page, setPage] = useState<number>(0);

  const best = metrics.bestPerformerAllTime;
  const worst = metrics.worstPerformerAllTime;
  const mdd = metrics.maxDrawdownDetail;
  const mddPercent = mdd
    ? (((mdd.peakValueUsd - mdd.troughValueUsd) / mdd.peakValueUsd) * 100).toFixed(2)
    : null;

  // Page 2 metrics
  const riskScore = metrics.riskScore ?? 0;
  const riskScoreBand = getRiskScoreBand(riskScore);
  const volatility = metrics.volatilityPercent;
  const volatilityPercentile = metrics.volatilityPercentile ?? 50;
  const concentration = metrics.concentrationIndex;
  const downsideRisk = metrics.downsideRiskPercent;
  const violatedRules = metrics.violatedRulesCount ?? 0;

  // Page 3 metrics
  const sortino = metrics.sortinoRatio30d;
  const calmar = metrics.calmarRatio30d;
  const var95 = metrics.var95Percent;
  const expectedShortfall = metrics.expectedShortfallPercent;
  const beta = metrics.beta;
  const topRiskSymbol = metrics.topRiskContributorSymbol;
  const topRiskPercent = metrics.topRiskContributorPercent;

  const allTimeProfitTooltip = (
    <div className="space-y-2 text-[11px] leading-relaxed">
      <div className="font-bold text-strong border-b border-white/6 pb-1">How is it calculated?</div>
      <ul className="list-disc pl-3.5 space-y-1.5 text-muted">
        <li>
          <span className="font-semibold text-strong">All-time Profit</span> = Realised Profit + Unrealised Profit
        </li>
        <li>
          <span className="font-semibold text-strong">Realised Profit</span> = (Selling Price - Avg Buy Price) × Amount Sold - Selling Fees
        </li>
        <li>
          <span className="font-semibold text-strong">Unrealised Profit</span> = (Current Market Price - Avg Buy Price) × Amount Held
        </li>
      </ul>
      <a
        href="https://en.wikipedia.org/wiki/Profit_(economics)"
        target="_blank"
        rel="noopener noreferrer"
        className="group/link inline-flex items-center gap-0.5 pt-1.5 text-[11px] font-semibold text-primary hover:underline cursor-pointer transition-colors duration-200"
      >
        Learn more
        <span className="transition-transform duration-200 group-hover/link:translate-x-0.5">→</span>
      </a>
    </div>
  );

  const costBasisTooltip = (
    <div className="space-y-2 text-[11px] leading-relaxed">
      <div className="font-bold text-strong border-b border-white/6 pb-1">How is it calculated?</div>
      <p className="text-muted">
        We use the Average Cost Basis (ACB) method for calculation:
      </p>
      <ul className="list-disc pl-3.5 space-y-1.5 text-muted">
        <li>
          <span className="font-semibold text-strong">Cost Basis</span> = Sum (Buy Price × Buy Amount) + Sum (Buying Fees)
        </li>
      </ul>
      <a
        href="https://www.investopedia.com/terms/c/costbasis.asp"
        target="_blank"
        rel="noopener noreferrer"
        className="group/link inline-flex items-center gap-0.5 pt-1.5 text-[11px] font-semibold text-primary hover:underline cursor-pointer transition-colors duration-200"
      >
        Learn more
        <span className="transition-transform duration-200 group-hover/link:translate-x-0.5">→</span>
      </a>
    </div>
  );

  const riskScoreTooltip = (
    <div className="space-y-3 text-[11px] leading-relaxed">
      <div className="font-bold text-strong border-b border-white/6 pb-1">How is it calculated?</div>
      <p className="text-muted">
        Risk Score is a 0–100 composite portfolio risk index. Higher values indicate higher overall portfolio risk.
        It is calculated from standardized 0–100 component scores using the weighted formula:
      </p>
      <div className="rounded-xl border border-white/6 bg-black/10 px-3 py-2 text-[11px] text-muted">
        <p className="font-semibold text-strong">Risk Score =</p>
        <ul className="mt-1.5 space-y-1.5">
          <li>0.20 × Volatility Score</li>
          <li>0.25 × Expected Shortfall Score</li>
          <li>0.20 × Max Drawdown Score</li>
          <li>0.15 × Concentration Score</li>
          <li>0.10 × Beta Score</li>
          <li>0.10 × Stress / Breach Penalty Score</li>
        </ul>
      </div>
    </div>
  );

  const handlePrev = () => setPage((p) => (p === 0 ? 2 : p === 1 ? 0 : 1));
  const handleNext = () => setPage((p) => (p === 0 ? 1 : p === 1 ? 2 : 0));

  return (
    <section className="mb-6 relative group/metrics lg:mb-8 w-full">
      {/* Left Arrow Button */}
      <button
        type="button"
        onClick={handlePrev}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-(--surface-glass) backdrop-blur-md text-muted shadow-lg opacity-100 lg:opacity-[0.25] lg:group-hover/metrics:opacity-100 transition-all hover:bg-white/10 hover:text-strong cursor-pointer focus-visible:outline-none"
        aria-label="Previous page"
      >
        <MaterialIcon name="chevron_left" />
      </button>

      {/* Metrics Grid */}
      <div 
        key={page}
        className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4 w-full animate-[fadeSlideIn_0.2s_ease_both]"
      >
        {page === 0 ? (
          <>
            {/* Card 1: All-time Profit */}
            <MetricCard
              title="All-time Profit"
              tooltipText={allTimeProfitTooltip}
              tooltipPosition="left"
              tooltipWidthClass="w-80 md:w-[350px]"
              value={
                <p className={`text-xl font-bold leading-tight ${metrics.allTimeProfitUsd >= 0 ? "text-success" : "text-danger"}`}>
                  {usdFormatter.format(metrics.allTimeProfitUsd)}
                </p>
              }
            >
              <div className={`mt-1.5 status-pill w-max text-xs ${metrics.allTimeProfitUsd >= 0 ? "status-pill-positive" : "status-pill-negative"}`}>
                <span className="flex items-center gap-0.5">
                  <MaterialIcon
                    name={metrics.allTimeProfitUsd >= 0 ? "arrow_upward" : "arrow_downward"}
                    outlined={false}
                    className="text-xs"
                  />
                  {Math.abs(metrics.allTimeProfitPercent).toFixed(2)}%
                </span>
              </div>
            </MetricCard>

            {/* Card 2: Cost Basis */}
            <MetricCard
              title="Cost Basis"
              tooltipText={costBasisTooltip}
              tooltipPosition="center"
              tooltipWidthClass="w-80 md:w-[350px]"
              value={
                <p className="text-xl font-bold leading-tight text-strong">
                  {usdFormatter.format(metrics.totalCostBasisUsd)}
                </p>
              }
            />

            {/* Card 3: Performance */}
            <MetricCard
              colSpan={2}
              value={
                <div className="grid grid-cols-2 gap-x-3 divide-x divide-white/10">
                  {/* Best */}
                  <div className="pr-3">
                    <p className="mb-0.5 text-xs text-muted">Best Performer</p>
                    <p className="truncate text-base font-bold text-strong mt-0.5">
                      {best ? formatSymbol(best.symbol) : "N/A"}
                    </p>
                    {best ? (
                      <p className="text-xs font-semibold text-success mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span>{formatAbsolutePnl(best.pnlUsd)}</span>
                        <span className="flex items-center gap-0.5">
                          <span>▲</span>
                          <span>{best.pnlPercent.toFixed(2)}%</span>
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-success mt-1.5">—</p>
                    )}
                  </div>
                  {/* Worst */}
                  <div className="pl-3">
                    <p className="mb-0.5 text-xs text-muted">Worst Performer</p>
                    <p className="truncate text-base font-bold text-strong mt-0.5">
                      {worst ? formatSymbol(worst.symbol) : "N/A"}
                    </p>
                    {worst ? (
                      <p className="text-xs font-semibold text-danger mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span>{formatAbsolutePnl(worst.pnlUsd)}</span>
                        <span className="flex items-center gap-0.5">
                          <span>▼</span>
                          <span>{Math.abs(worst.pnlPercent).toFixed(2)}%</span>
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-danger mt-1.5">—</p>
                    )}
                  </div>
                </div>
              }
            />

            {/* Card 4: Sharpe Ratio */}
            <MetricCard
              headerAlignClass="items-start"
              title={
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-strong leading-none">Sharpe Ratio</span>
                  <span className="text-[10px] font-normal text-muted leading-none">Risk-adjusted return</span>
                </div>
              }
              tooltipText="Measure of risk-adjusted return across 7D, 30D, and 90D timeframes. Higher values indicate better return per unit of volatility."
              tooltipPosition="center"
              value={
                <div className="grid grid-cols-3 gap-1 pt-4 mt-2 pb-1.5">
                  {/* 7D */}
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-bold text-muted/70 tracking-wider uppercase leading-none">7D</span>
                    <span className={`text-base font-bold mt-2.5 leading-none ${getSharpeQuality(metrics.sharpeRatio7d).colorClass}`}>
                      {metrics.sharpeRatio7d !== null && metrics.sharpeRatio7d !== undefined
                        ? metrics.sharpeRatio7d.toFixed(2)
                        : "—"}
                    </span>
                    <span className="text-[10px] text-muted font-normal mt-2 leading-none">
                      {getSharpeQuality(metrics.sharpeRatio7d).label}
                    </span>
                  </div>
                  
                  {/* 30D */}
                  <div className="flex flex-col items-start pl-2">
                    <span className="text-[10px] font-bold text-muted/70 tracking-wider uppercase leading-none">30D</span>
                    <span className={`text-base font-bold mt-2.5 leading-none ${getSharpeQuality(metrics.sharpeRatio30d).colorClass}`}>
                      {metrics.sharpeRatio30d !== null && metrics.sharpeRatio30d !== undefined
                        ? metrics.sharpeRatio30d.toFixed(2)
                        : "—"}
                    </span>
                    <span className="text-[10px] text-muted font-normal mt-2 leading-none">
                      {getSharpeQuality(metrics.sharpeRatio30d).label}
                    </span>
                  </div>
                  
                  {/* 90D */}
                  <div className="flex flex-col items-start pl-2">
                    <span className="text-[10px] font-bold text-muted/70 tracking-wider uppercase leading-none">90D</span>
                    <span className={`text-base font-bold mt-2.5 leading-none ${getSharpeQuality(metrics.sharpeRatio90d).colorClass}`}>
                      {metrics.sharpeRatio90d !== null && metrics.sharpeRatio90d !== undefined
                        ? metrics.sharpeRatio90d.toFixed(2)
                        : "—"}
                    </span>
                    <span className="text-[10px] text-muted font-normal mt-2 leading-none">
                      {getSharpeQuality(metrics.sharpeRatio90d).label}
                    </span>
                  </div>
                </div>
              }
            />

            {/* Card 5: Max Drawdown */}
            <MetricCard
              title="Max Drawdown"
              tooltipText="The largest peak-to-trough drop in portfolio value before a new peak is achieved. Shows historical maximum loss risk."
              tooltipPosition="right"
              value={
                !mdd || !mddPercent ? (
                  <p className="text-xl font-bold text-muted">N/A</p>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold leading-tight text-danger">-{mddPercent}%</p>
                    <p className="text-xs text-muted">({usdCompactFormatter.format(mdd.troughValueUsd - mdd.peakValueUsd)})</p>
                  </div>
                )
              }
            >
              {mdd && mddPercent && (
                <div className="mt-2 space-y-0.5 text-xs">
                  {/* Peak → Trough */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 text-muted">
                      {usdCompactFormatter.format(mdd.peakValueUsd)}
                      <span className="mx-1 text-muted opacity-50">→</span>
                      {usdCompactFormatter.format(mdd.troughValueUsd)}
                    </span>
                    <span className="text-muted">{mdd.durationDays}d</span>
                  </div>
                  {/* Dates */}
                  <p className="text-muted opacity-70">
                    {dateShortFormatter.format(new Date(mdd.peakAt))} – {dateShortFormatter.format(new Date(mdd.troughAt))}
                  </p>
                  {/* Recovery */}
                  <div className="pt-0.5 text-xs font-medium">
                    <DrawdownRecovery detail={mdd} />
                  </div>
                </div>
              )}
            </MetricCard>
          </>
        ) : page === 1 ? (
          <>
            {/* Card 1: Risk Score */}
            <MetricCard
              title="Risk Score"
              tooltipText={riskScoreTooltip}
              tooltipPosition="left"
              tooltipWidthClass="w-[22rem] md:w-[26rem]"
              value={
                <div className="flex items-baseline">
                  <span className={`text-xl font-bold leading-tight ${riskScoreBand.textClass}`}>
                    {riskScore.toFixed(1)}
                  </span>
                  <span className="text-xs font-normal text-muted ml-0.5">/100</span>
                </div>
              }
            >
              <div className={`mt-1.5 text-xs font-semibold ${riskScoreBand.textClass}`}>
                {riskScoreBand.label}
              </div>
            </MetricCard>

            {/* Card 2: Realized Volatility */}
            <MetricCard
              title="Realized Volatility"
              tooltipText="Realized Volatility is the annualized standard deviation of daily portfolio returns over a 30-day rolling window. The percentile compares current volatility with the selected historical or benchmark distribution."
              tooltipPosition="center"
              value={
                <p className="text-xl font-bold leading-tight text-strong">
                  {volatility !== undefined && volatility !== null ? `${volatility.toFixed(2)}%` : "N/A"}
                </p>
              }
            >
              {volatility !== undefined && volatility !== null ? (
                <div className="mt-1.5 space-y-0.5">
                  <div className={`text-xs font-semibold ${getVolatilityRiskBand(volatilityPercentile).colorClass}`}>
                    {getVolatilityRiskBand(volatilityPercentile).label}
                  </div>
                  <p className="text-[10px] text-muted leading-none">
                    {getOrdinalSuffix(volatilityPercentile)} pct. · 30D annualized
                  </p>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-muted leading-snug">Volatility diagnostics</p>
              )}
            </MetricCard>

            {/* Card 3: Concentration (HHI) */}
            <MetricCard
              title="Concentration (HHI)"
              tooltipText="Herfindahl-Hirschman Index measuring asset allocation distribution. Lower values indicate better diversification."
              tooltipPosition="center"
              value={
                <p className="text-xl font-bold leading-tight text-strong">
                  {concentration !== undefined && concentration !== null ? concentration.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "N/A"}
                </p>
              }
            >
              {concentration !== undefined && concentration !== null ? (
                <div className={`mt-1.5 text-xs font-semibold ${getConcentrationLabel(concentration).colorClass}`}>
                  {getConcentrationLabel(concentration).label}
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-muted leading-snug">Diversification index</p>
              )}
            </MetricCard>

            {/* Card 4: Downside Risk */}
            <MetricCard
              title="Downside Risk"
              tooltipText="Downside deviation of returns. Measures volatility of negative returns (Sortino denominator). Lower is better."
              tooltipPosition="center"
              value={
                <p className="text-xl font-bold leading-tight text-strong">
                  {downsideRisk !== undefined && downsideRisk !== null ? `${downsideRisk.toFixed(2)}%` : "N/A"}
                </p>
              }
            >
              {downsideRisk !== undefined && downsideRisk !== null ? (
                <div className={`mt-1.5 text-xs font-semibold ${
                  downsideRisk >= 30 ? "text-danger" : downsideRisk >= 15 ? "text-warning" : "text-success"
                }`}>
                  {downsideRisk >= 30 ? "High Downside" : downsideRisk >= 15 ? "Moderate Downside" : "Low Downside"}
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-muted leading-snug">Downside volatility</p>
              )}
            </MetricCard>

            {/* Card 5: Risk Rules Breached */}
            <MetricCard
              title="Risk Breaches"
              tooltipText="The number of custom risk monitoring rules (e.g. max allocation, drawdown limits) currently violated."
              tooltipPosition="right"
              value={
                <p className={`text-xl font-bold leading-tight ${violatedRules > 0 ? "text-danger" : "text-success"}`}>
                  {violatedRules}
                </p>
              }
            >
              <div className={`mt-1.5 status-pill w-max text-xs ${violatedRules > 0 ? "status-pill-negative" : "status-pill-positive"}`}>
                {violatedRules > 0 ? "Action Required" : "Safe"}
              </div>
              <p className="mt-1.5 text-xs text-muted leading-snug">Active rules breached</p>
            </MetricCard>
          </>
        ) : (
          <>
            {/* Page 3: Advanced Portfolio Analytics */}
            <MetricCard
              title="Sortino Ratio"
              tooltipText="Sortino Ratio measures the risk-adjusted return of a portfolio relative to its downside volatility. It ignores upside volatility, making it more suitable for asymmetrical return profiles."
              tooltipPosition="left"
              value={
                <p className="text-xl font-bold leading-tight text-strong">
                  {sortino !== null && sortino !== undefined ? sortino.toFixed(2) : "—"}
                </p>
              }
            >
              {sortino !== null && sortino !== undefined ? (
                <div className="mt-1.5">
                  <div className={`text-xs font-semibold ${getRatioQuality(sortino).colorClass}`}>
                    {getRatioQuality(sortino).label}
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-muted leading-snug">Risk-adjusted return</p>
              )}
            </MetricCard>

            {/* Card 2: Calmar Ratio */}
            <MetricCard
              title="Calmar Ratio"
              tooltipText="Calmar Ratio measures the annualized return of the portfolio relative to its maximum drawdown over the same period. Higher values indicate better return per unit of tail risk."
              tooltipPosition="center"
              value={
                <p className="text-xl font-bold leading-tight text-strong">
                  {calmar !== null && calmar !== undefined ? calmar.toFixed(2) : "—"}
                </p>
              }
            >
              {calmar !== null && calmar !== undefined ? (
                <div className="mt-1.5">
                  <div className={`text-xs font-semibold ${getRatioQuality(calmar).colorClass}`}>
                    {getRatioQuality(calmar).label}
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-muted leading-snug">Return vs drawdown</p>
              )}
            </MetricCard>

            {/* Card 3: VaR / Expected Shortfall */}
            <MetricCard
              title="VaR / Expected Shortfall"
              tooltipText="Value at Risk (VaR 95%) represents the maximum expected loss over a 1-day horizon at a 95% confidence level. Expected Shortfall (ES 95%) measures the average loss on days when the VaR threshold is breached."
              tooltipPosition="center"
              value={
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <div className="flex items-baseline justify-between w-full">
                    <span className="text-[10px] font-bold text-muted/70 tracking-wider uppercase leading-none">VaR (95%)</span>
                    <span className="text-sm font-bold text-strong leading-none">
                      {var95 !== null && var95 !== undefined ? `-${var95.toFixed(2)}%` : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between w-full border-t border-white/5 pt-1 mt-0.5">
                    <span className="text-[10px] font-bold text-muted/70 tracking-wider uppercase leading-none">ES (95%)</span>
                    <span className="text-sm font-bold text-danger leading-none">
                      {expectedShortfall !== null && expectedShortfall !== undefined ? `-${expectedShortfall.toFixed(2)}%` : "—"}
                    </span>
                  </div>
                </div>
              }
            />

            {/* Card 4: Beta vs Benchmark */}
            <MetricCard
              title="Beta vs Benchmark"
              tooltipText="Beta measures the volatility sensitivity of the portfolio relative to a benchmark (BTCUSDT). A beta of 1.0 indicates moving in lockstep with the market, while >1.0 indicates amplified sensitivity."
              tooltipPosition="center"
              value={
                <p className="text-xl font-bold leading-tight text-strong">
                  {beta !== null && beta !== undefined ? beta.toFixed(2) : "—"}
                </p>
              }
            >
              {beta !== null && beta !== undefined ? (
                <div className="mt-1.5">
                  <div className={`text-xs font-semibold ${getBetaLabel(beta).colorClass}`}>
                    {getBetaLabel(beta).label}
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-muted leading-snug">Market sensitivity</p>
              )}
            </MetricCard>

            {/* Card 5: Risk Contribution */}
            <MetricCard
              title="Risk Contribution"
              tooltipText="Risk Contribution shows how much of the total portfolio risk is driven by each asset, computed as the weight-adjusted standalone volatility of the asset relative to the portfolio total."
              tooltipPosition="right"
              value={
                <p className="text-xl font-bold leading-tight text-strong">
                  {topRiskPercent !== null && topRiskPercent !== undefined ? `${topRiskPercent.toFixed(1)}%` : "—"}
                </p>
              }
            >
              {topRiskSymbol ? (
                <div className="mt-1.5">
                  <div className="text-xs font-semibold text-warning">
                    {formatSymbol(topRiskSymbol)}
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-muted leading-snug">Largest risk driver</p>
              )}
            </MetricCard>
          </>
        )}
      </div>

      {/* Right Arrow Button */}
      <button
        type="button"
        onClick={handleNext}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-(--surface-glass) backdrop-blur-md text-muted shadow-lg opacity-100 lg:opacity-[0.25] lg:group-hover/metrics:opacity-100 transition-all hover:bg-white/10 hover:text-strong cursor-pointer focus-visible:outline-none"
        aria-label="Next page"
      >
        <MaterialIcon name="chevron_right" />
      </button>

    </section>
  );
}
