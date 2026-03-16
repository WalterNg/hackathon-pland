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
    <section className="relative mb-6 flex flex-col justify-between gap-6 overflow-hidden rounded-3xl bg-sidebar-dark p-5 text-inverse sm:p-6 lg:mb-8 lg:flex-row lg:items-center lg:p-8">
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-linear-to-l from-primary to-transparent opacity-15" />

      <div>
        <div className="mb-2 flex items-center gap-3 text-subtle">
          <span className="typo-body-xs uppercase tracking-wider">Total Portfolio Value</span>
        </div>
        <div>
          <h2 className="text-5xl font-bold tracking-tight">{totalValueBtcLabel}</h2>
          <div className={`mt-2 flex items-center gap-1 ${isProfitPositive ? "text-primary" : "text-danger"}`}>
            <MaterialIcon
              name={isProfitPositive ? "arrow_upward" : "arrow_downward"}
              outlined={false}
              className="text-xs"
            />
            <span className="typo-body-sm font-semibold">{allTimeProfitPercentLabel}</span>
          </div>
        </div>
      </div>

      <div className="hidden items-center gap-8 lg:flex lg:-mt-4">
        <div className="text-right">
          <p className="mb-1 text-xs uppercase text-subtle">24h Volume</p>
          <p className="text-5xl font-bold tracking-tight">{volumeBtc !== null ? `${volumeBtc.toFixed(6)} BTC` : "N/A"}</p>
        </div>
      </div>
    </section>
  );
}
