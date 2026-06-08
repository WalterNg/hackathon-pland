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

function getConcentrationLabel(hhi: number): { label: string; colorClass: string } {
  if (hhi >= 4000) return { label: "Very Concentrated", colorClass: "text-danger" };
  if (hhi >= 2000) return { label: "Moderately Concentrated", colorClass: "text-warning" };
  return { label: "Well Diversified", colorClass: "text-success" };
}

function formatAbsolutePnl(pnlUsd: number): string {
  const absPnl = Math.abs(pnlUsd);
  const sign = pnlUsd >= 0 ? "+" : "-";
  return sign + usdFormatter.format(absPnl);
}

export function PortfolioMetrics({ metrics }: PortfolioMetricsProps) {
  const [page, setPage] = useState<0 | 1>(0);

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
  const concentration = metrics.concentrationIndex;
  const downsideRisk = metrics.downsideRiskPercent;
  const violatedRules = metrics.violatedRulesCount ?? 0;

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

  const handlePrev = () => setPage((p) => (p === 1 ? 0 : 1));
  const handleNext = () => setPage((p) => (p === 0 ? 1 : 0));

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
        ) : (
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

            {/* Card 2: Volatility */}
            <MetricCard
              title="Volatility"
              tooltipText="Standard deviation of daily portfolio returns over the last 30 days, annualized. Shows price fluctuation intensity."
              tooltipPosition="center"
              value={
                <p className="text-xl font-bold leading-tight text-strong">
                  {volatility !== undefined && volatility !== null ? `${volatility.toFixed(2)}%` : "N/A"}
                </p>
              }
            >
              <p className="mt-1.5 text-xs text-muted leading-snug">30d Daily Volatility</p>
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
