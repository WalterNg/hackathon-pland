import type { PortfolioMetrics as PortfolioMetricsType } from "@/app/lib/portfolio-types";
import { MaterialIcon } from "../dashboard/material-icon";

type PortfolioMetricsProps = {
  metrics: PortfolioMetricsType;
  btcPriceUsd: number | null;
};

const symbolNames: Record<string, string> = {
  BTCUSDT: "Bitcoin",
  ETHUSDT: "Ethereum",
  BNBUSDT: "BNB",
  SOLUSDT: "Solana",
  DOGEUSDT: "Dogecoin"
};

function formatBtc(usdAmount: number, btcPriceUsd: number | null): string {
  if (!btcPriceUsd || !Number.isFinite(btcPriceUsd) || btcPriceUsd <= 0) {
    return "N/A";
  }

  return `${(usdAmount / btcPriceUsd).toFixed(6)} BTC`;
}

export function PortfolioMetrics({ metrics, btcPriceUsd }: PortfolioMetricsProps) {
  const best = metrics.bestPerformer24h;
  const worst = metrics.worstPerformer24h;

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:mb-8 lg:grid-cols-4">
      <article className="rounded-2xl border-2 border-gray-100 bg-card-light p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="typo-body-sm font-medium text-muted">All-time Profit</h3>
          <MaterialIcon name="info" outlined={false} className="text-sm text-gray-300" />
        </div>

        <p className={`mb-1 text-2xl font-bold ${metrics.allTimeProfitUsd >= 0 ? "text-success" : "text-danger"}`}>
          {formatBtc(metrics.allTimeProfitUsd, btcPriceUsd)}
        </p>

        <div
          className={`w-max rounded-md px-2 py-1 text-xs ${metrics.allTimeProfitUsd >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
        >
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

      <article className="rounded-2xl border-2 border-gray-100 bg-card-light p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="typo-body-sm font-medium text-muted">Cost Basis</h3>
          <MaterialIcon name="info" outlined={false} className="text-sm text-gray-300" />
        </div>

        <p className="mb-1 text-2xl font-bold text-strong">{formatBtc(metrics.totalCostBasisUsd, btcPriceUsd)}</p>
      </article>

      <article className="rounded-2xl border-2 border-gray-100 bg-card-light p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="typo-body-sm font-medium text-muted">Best Performer</h3>
        </div>

        <p className="mb-1 text-2xl font-bold text-strong">
          {best ? `${symbolNames[best.symbol] ?? best.symbol.replace("USDT", "")} (${best.symbol.replace("USDT", "")})` : "N/A"}
        </p>
        <div className="w-max rounded-md bg-success-soft px-2 py-1 text-xs text-success">
          <span className="font-semibold">{best ? `${best.change24hPercent.toFixed(2)}%` : "0.00%"}</span>
        </div>
      </article>

      <article className="rounded-2xl border-2 border-gray-100 bg-card-light p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="typo-body-sm font-medium text-muted">Worst Performer</h3>
        </div>

        <p className="mb-1 text-2xl font-bold text-strong">
          {worst ? `${symbolNames[worst.symbol] ?? worst.symbol.replace("USDT", "")} (${worst.symbol.replace("USDT", "")})` : "N/A"}
        </p>
        <div className="w-max rounded-md bg-danger-soft px-2 py-1 text-xs text-danger">
          <span className="font-semibold">{worst ? `${worst.change24hPercent.toFixed(2)}%` : "0.00%"}</span>
        </div>
      </article>
    </section>
  );
}
