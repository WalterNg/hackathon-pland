import type { PortfolioAssetRow, PortfolioMetrics, PortfolioSummary } from "@/app/lib/portfolio-types";
import { MaterialIcon } from "./material-icon";

type OverviewTableProps = {
  summary: PortfolioSummary;
  metrics: PortfolioMetrics;
  assets: PortfolioAssetRow[];
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

export function OverviewTable({ summary, metrics, assets }: OverviewTableProps) {
  const marketValue = summary.totalValueUsd;
  const netCost = metrics.totalCostBasisUsd;
  const holdingsBtc = summary.totalValueBtc;
  const pnlUsd = metrics.allTimeProfitUsd;
  const pnlPercent = metrics.allTimeProfitPercent;
  const weighted24hChange =
    assets.reduce((sum, asset) => sum + asset.change24hPercent * (asset.allocationPercent / 100), 0) || 0;
  const isPositivePnl = pnlUsd >= 0;
  const isPositive24h = weighted24hChange >= 0;

  return (
    <div className="rounded-2xl bg-mint-card p-5 shadow-soft sm:p-6">
      <h3 className="typo-section text-strong mb-4">Overview</h3>
      <div className="overflow-x-auto">
        <table className="typo-body-sm w-full text-left">
          <thead className="text-muted typo-body-xs border-b border-gray-200/50 uppercase">
            <tr>
              <th className="text-subtle py-3 font-medium">Market Value</th>
              <th className="text-subtle py-3 font-medium">Net Cost</th>
              <th className="text-subtle py-3 font-medium">Holdings</th>
              <th className="text-subtle py-3 font-medium">Profit/Loss</th>
              <th className="text-subtle py-3 text-right font-medium">Change (24H)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-strong py-4 text-base font-bold">
                {usdFormatter.format(marketValue)}
                <div className="text-muted typo-caption mt-1 font-normal">Live portfolio valuation</div>
              </td>
              <td className="text-body py-4 font-medium">
                {usdFormatter.format(netCost)}
                <div className={`typo-caption mt-1 font-bold ${isPositivePnl ? "text-positive" : "text-danger"}`}>
                  {isPositivePnl ? "+" : ""}
                  {pnlPercent.toFixed(2)}%
                </div>
              </td>
              <td className="text-body py-4 font-medium">
                {holdingsBtc !== null ? `${holdingsBtc.toFixed(5)} BTC` : "N/A"}
                <div className="text-muted typo-caption mt-1 font-normal">BTC-equivalent exposure</div>
              </td>
              <td className="text-body py-4 font-medium">
                {isPositivePnl ? "+" : ""}
                {usdFormatter.format(pnlUsd)}
                <div className={`typo-caption mt-1 font-bold ${isPositivePnl ? "text-positive" : "text-danger"}`}>
                  {isPositivePnl ? "+" : ""}
                  {pnlPercent.toFixed(2)}% profit
                </div>
              </td>
              <td className="py-4 text-right">
                <span
                  className={`typo-body-xs inline-flex items-center gap-1 rounded px-2 py-1 font-bold ${isPositive24h ? "bg-mint-light text-success" : "bg-danger-soft text-danger"}`}
                >
                  <MaterialIcon name={isPositive24h ? "arrow_drop_up" : "arrow_drop_down"} className="text-[10px]" />
                  {Math.abs(weighted24hChange).toFixed(2)}%
                </span>
                <div className="text-muted typo-caption mt-1">Last 24 hours</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
