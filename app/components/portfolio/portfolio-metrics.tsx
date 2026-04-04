import type { PortfolioMetrics as PortfolioMetricsType } from "@/app/lib/portfolio-types";
import { MaterialIcon } from "../dashboard/material-icon";

type PortfolioMetricsProps = {
  metrics: PortfolioMetricsType;
};

const symbolNames: Record<string, string> = {
  BTCUSDT: "Bitcoin",
  ETHUSDT: "Ethereum",
  BNBUSDT: "BNB",
  SOLUSDT: "Solana",
  DOGEUSDT: "Dogecoin"
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

export function PortfolioMetrics({ metrics }: PortfolioMetricsProps) {
  const best = metrics.bestPerformer24h;
  const worst = metrics.worstPerformer24h;

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:mb-8 lg:grid-cols-4">
      <article className="panel-base p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="typo-body-sm font-medium text-muted">All-time Profit</h3>
        </div>

        <p className={`mb-1 text-2xl font-bold ${metrics.allTimeProfitUsd >= 0 ? "text-success" : "text-danger"}`}>
          {usdFormatter.format(metrics.allTimeProfitUsd)}
        </p>

        <div className={`status-pill ${metrics.allTimeProfitUsd >= 0 ? "status-pill-positive" : "status-pill-negative"}`}>
          <span className="flex items-center">
            <MaterialIcon
              name={metrics.allTimeProfitUsd >= 0 ? "arrow_upward" : "arrow_downward"}
              outlined={false}
              className="mr-1 text-xs"
            />
            {Math.abs(metrics.allTimeProfitPercent).toFixed(2)}%
          </span>
        </div>
      </article>

      <article className="panel-base p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="typo-body-sm font-medium text-muted">Cost Basis</h3>
        </div>

        <p className="mb-1 text-2xl font-bold text-strong">{usdFormatter.format(metrics.totalCostBasisUsd)}</p>
      </article>

      <article className="panel-base p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="typo-body-sm font-medium text-muted">Best Performer</h3>
        </div>

        <p className="mb-1 text-2xl font-bold text-strong">
          {best ? `${symbolNames[best.symbol] ?? best.symbol.replace("USDT", "")} (${best.symbol.replace("USDT", "")})` : "N/A"}
        </p>
        <div className="status-pill status-pill-positive w-max">
          <span className="font-semibold">{best ? `${best.change24hPercent.toFixed(2)}%` : "0.00%"}</span>
        </div>
      </article>

      <article className="panel-base p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="typo-body-sm font-medium text-muted">Worst Performer</h3>
        </div>

        <p className="mb-1 text-2xl font-bold text-strong">
          {worst ? `${symbolNames[worst.symbol] ?? worst.symbol.replace("USDT", "")} (${worst.symbol.replace("USDT", "")})` : "N/A"}
        </p>
        <div className="status-pill status-pill-negative w-max">
          <span className="font-semibold">{worst ? `${worst.change24hPercent.toFixed(2)}%` : "0.00%"}</span>
        </div>
      </article>
    </section>
  );
}
