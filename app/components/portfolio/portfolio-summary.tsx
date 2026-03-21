import type { PortfolioMetrics, PortfolioSummary as PortfolioSummaryType } from "@/app/lib/portfolio-types";
import { MaterialIcon } from "../dashboard/material-icon";

type PortfolioSummaryProps = {
  summary: PortfolioSummaryType;
  metrics: PortfolioMetrics;
};

export function PortfolioSummary({ summary, metrics }: PortfolioSummaryProps) {
  const btcPriceUsd = summary.btcPriceUsd;
  const totalValueBtcLabel = summary.totalValueBtc !== null ? `${summary.totalValueBtc.toFixed(4)} BTC` : "N/A";
  const volumeBtc = btcPriceUsd && btcPriceUsd > 0 ? metrics.totalVolume24hUsd / btcPriceUsd : null;
  const isProfitPositive = metrics.allTimeProfitPercent >= 0;
  const allTimeProfitPercentLabel = `${isProfitPositive ? "+" : ""}${metrics.allTimeProfitPercent.toFixed(2)}%`;

  return (
    <section className="relative mb-6 flex flex-col justify-between gap-6 overflow-hidden rounded-[1.75rem] bg-sidebar-dark p-6 text-inverse shadow-[0_24px_60px_rgba(0,0,0,0.34)] sm:p-7 lg:mb-8 lg:flex-row lg:items-center lg:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(60,227,106,0.18),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(136,180,255,0.12),transparent_24%)]" />

      <div className="relative">
        <div className="mb-2 flex items-center gap-3 text-subtle">
          <span className="eyebrow">Total Portfolio Value</span>
        </div>
        <div>
          <h2 className="metric-display">{totalValueBtcLabel}</h2>
          <div className={`mt-3 flex items-center gap-2 ${isProfitPositive ? "text-primary" : "text-danger"}`}>
            <MaterialIcon
              name={isProfitPositive ? "arrow_upward" : "arrow_downward"}
              outlined={false}
              className="text-xs"
            />
            <span className="typo-body-sm font-semibold">{allTimeProfitPercentLabel}</span>
          </div>
        </div>
      </div>

      <div className="relative hidden items-center gap-8 lg:flex lg:-mt-4">
        <div className="h-24 w-px bg-white/8" />
        <div className="text-right">
          <p className="eyebrow mb-3 text-subtle">24h Volume</p>
          <p className="typo-display">{volumeBtc !== null ? `${volumeBtc.toFixed(6)} BTC` : "N/A"}</p>
        </div>
      </div>
    </section>
  );
}
