import type { MaxDrawdownDetail, PortfolioMetrics as PortfolioMetricsType } from "@/app/lib/portfolio-types";
import { MaterialIcon } from "../dashboard/material-icon";

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

type SharpeBand = { label: string; colorClass: string; pillClass: string };

function getSharpeBand(sharpe: number): SharpeBand {
  if (sharpe >= 2.0) return { label: "Excellent", colorClass: "text-success", pillClass: "status-pill-positive" };
  if (sharpe >= 1.0) return { label: "Good",      colorClass: "text-success", pillClass: "status-pill-positive" };
  if (sharpe >= 0.5) return { label: "Average",   colorClass: "text-muted",   pillClass: "status-pill-neutral"  };
  if (sharpe >= 0)   return { label: "Below Avg", colorClass: "text-warning", pillClass: "status-pill-neutral"  };
  return               { label: "Poor",      colorClass: "text-danger",  pillClass: "status-pill-negative" };
}

function DrawdownRecovery({ detail }: { detail: MaxDrawdownDetail }) {
  if (detail.recovered) {
    return (
      <span className="flex items-center gap-0.5 text-success">
        <MaterialIcon name="check_circle" outlined={false} className="text-xs" />
        Recovered in {detail.recoveryDays}d
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-warning">
      <MaterialIcon name="schedule" outlined className="text-xs" />
      Not recovered
    </span>
  );
}

export function PortfolioMetrics({ metrics }: PortfolioMetricsProps) {
  const best = metrics.bestPerformer24h;
  const worst = metrics.worstPerformer24h;
  const sharpe = metrics.sharpeRatio30d;
  const mdd = metrics.maxDrawdownDetail;
  const mddPercent = mdd
    ? (((mdd.peakValueUsd - mdd.troughValueUsd) / mdd.peakValueUsd) * 100).toFixed(2)
    : null;

  return (
    <section className="mb-6 grid grid-cols-2 gap-3 lg:mb-8 lg:grid-cols-5 lg:gap-4">

      {/* ── All-time Profit ── */}
      <article className="panel-base px-4 py-3.5">
        <p className="mb-1.5 text-xs font-medium text-muted">All-time Profit</p>
        <p className={`text-xl font-bold leading-tight ${metrics.allTimeProfitUsd >= 0 ? "text-success" : "text-danger"}`}>
          {usdFormatter.format(metrics.allTimeProfitUsd)}
        </p>
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
      </article>

      {/* ── Cost Basis ── */}
      <article className="panel-base px-4 py-3.5">
        <p className="mb-1.5 text-xs font-medium text-muted">Cost Basis</p>
        <p className="text-xl font-bold leading-tight text-strong">
          {usdFormatter.format(metrics.totalCostBasisUsd)}
        </p>
      </article>

      {/* ── Best + Worst Performer ── */}
      <article className="panel-base col-span-2 px-4 py-3.5 lg:col-span-1">
        <p className="mb-1.5 text-xs font-medium text-muted">24h Performance</p>
        <div className="grid grid-cols-2 gap-x-3 divide-x divide-white/10">
          {/* Best */}
          <div className="pr-3">
            <p className="mb-0.5 text-xs text-muted">Best</p>
            <p className="truncate text-sm font-bold text-strong">
              {best ? formatSymbol(best.symbol) : "N/A"}
            </p>
            <p className={`text-xs font-semibold ${(best?.change24hPercent ?? 0) >= 0 ? "text-success" : "text-danger"}`}>
              {best ? `${best.change24hPercent >= 0 ? "+" : ""}${best.change24hPercent.toFixed(2)}%` : "—"}
            </p>
          </div>
          {/* Worst */}
          <div className="pl-3">
            <p className="mb-0.5 text-xs text-muted">Worst</p>
            <p className="truncate text-sm font-bold text-strong">
              {worst ? formatSymbol(worst.symbol) : "N/A"}
            </p>
            <p className={`text-xs font-semibold ${(worst?.change24hPercent ?? 0) >= 0 ? "text-success" : "text-danger"}`}>
              {worst ? `${worst.change24hPercent >= 0 ? "+" : ""}${worst.change24hPercent.toFixed(2)}%` : "—"}
            </p>
          </div>
        </div>
      </article>

      {/* ── Sharpe Ratio ── */}
      <article className="panel-base px-4 py-3.5">
        <p className="mb-1.5 text-xs font-medium text-muted">
          Sharpe Ratio <span className="font-normal opacity-60">(30d)</span>
        </p>
        {sharpe === null || sharpe === undefined ? (
          <p className="text-xl font-bold text-muted">N/A</p>
        ) : (
          <>
            <p className={`text-xl font-bold leading-tight ${getSharpeBand(sharpe).colorClass}`}>
              {sharpe.toFixed(2)}
            </p>
            <div className={`mt-1.5 status-pill w-max text-xs ${getSharpeBand(sharpe).pillClass}`}>
              {getSharpeBand(sharpe).label}
            </div>
            <p className="mt-1.5 text-xs text-muted leading-snug">Return / risk unit</p>
          </>
        )}
      </article>

      {/* ── Max Drawdown ── */}
      <article className="panel-base px-4 py-3.5">
        <p className="mb-1.5 text-xs font-medium text-muted">Max Drawdown</p>
        {!mdd || !mddPercent ? (
          <p className="text-xl font-bold text-muted">N/A</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold leading-tight text-danger">-{mddPercent}%</p>
              <p className="text-xs text-muted">({usdCompactFormatter.format(mdd.troughValueUsd - mdd.peakValueUsd)})</p>
            </div>

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
          </>
        )}
      </article>

    </section>
  );
}
