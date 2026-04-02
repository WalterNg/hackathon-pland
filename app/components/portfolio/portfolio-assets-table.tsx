import type { PortfolioAssetRow } from "@/app/lib/portfolio-types";
import { MaterialIcon } from "../dashboard/material-icon";
import { getFullCoinName } from "@/app/lib/coin-names";

type PortfolioAssetsTableProps = {
  assets: PortfolioAssetRow[];
  btcPriceUsd: number | null;
};

const formatBtcValue = (usdValue: number, btcPriceUsd: number | null, fractionDigits = 6) => {
  if (!Number.isFinite(usdValue) || !btcPriceUsd || !Number.isFinite(btcPriceUsd) || btcPriceUsd <= 0) {
    return "N/A";
  }

  return `${(usdValue / btcPriceUsd).toFixed(fractionDigits)} BTC`;
};



function toDisplaySymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return symbol;
  }

  if (normalized.endsWith("USDT") && normalized.length > 4) {
    return normalized.slice(0, -4);
  }

  return normalized;
}

export function PortfolioAssetsTable({ assets, btcPriceUsd }: PortfolioAssetsTableProps) {
  return (
    <section className="panel-base mb-6 overflow-hidden lg:mb-8">
      <div className="p-5 sm:p-6">
        <h3 className="section-title">Assets</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="bg-(--surface-container-low) text-xs font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4 text-right">Price</th>
              <th className="px-6 py-4 text-right">1h%</th>
              <th className="px-6 py-4 text-right">24h%</th>
              <th className="px-6 py-4 text-right">7d%</th>
              <th className="px-6 py-4 text-right">Holdings</th>
              <th className="px-6 py-4 text-right">Avg. Buy Price</th>
              <th className="px-6 py-4 text-right">Profit/Loss</th>
            </tr>
          </thead>

          <tbody>
            {assets.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <div className="text-lg font-semibold text-strong">This portfolio is empty</div>
                  <div className="mt-1 text-sm text-muted">Use Add Transaction to create your first position.</div>
                </td>
              </tr>
            )}

            {assets.map((asset) => {
              const displaySymbol = toDisplaySymbol(asset.symbol);
              const change1hPercent = asset.change24hPercent / 24;
              const change7dPercent = asset.change7dPercent;
              const positive24h = asset.change24hPercent >= 0;
              const positive1h = change1hPercent >= 0;
              const positive7d = change7dPercent >= 0;
              const positivePnl = asset.pnlUsd >= 0;

              return (
                <tr key={asset.symbol} className="group transition-colors hover:bg-(--surface-container-low)">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--surface-container-highest) text-warning">
                        <MaterialIcon name="currency_bitcoin" outlined={false} className="text-sm" />
                      </div>
                      <div>
                        <div className="font-bold text-strong">{getFullCoinName(displaySymbol)}</div>
                        <div className="text-xs text-muted">{displaySymbol}</div>
                      </div>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-body">
                    {formatBtcValue(asset.priceUsd, btcPriceUsd)}
                  </td>

                  <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-medium ${positive1h ? "text-success" : "text-danger"}`}>
                    <span className="flex items-center justify-end gap-1">
                      <MaterialIcon name={positive1h ? "arrow_drop_up" : "arrow_drop_down"} outlined={false} className="text-[10px]" />
                      {Math.abs(change1hPercent).toFixed(2)}%
                    </span>
                  </td>

                  <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-medium ${positive24h ? "text-success" : "text-danger"}`}>
                    <span className="flex items-center justify-end gap-1">
                      <MaterialIcon name={positive24h ? "arrow_drop_up" : "arrow_drop_down"} outlined={false} className="text-[10px]" />
                      {Math.abs(asset.change24hPercent).toFixed(2)}%
                    </span>
                  </td>

                  <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-medium ${positive7d ? "text-success" : "text-danger"}`}>
                    <span className="flex items-center justify-end gap-1">
                      <MaterialIcon name={positive7d ? "arrow_drop_up" : "arrow_drop_down"} outlined={false} className="text-[10px]" />
                      {Math.abs(change7dPercent).toFixed(2)}%
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="text-sm font-bold text-strong">{formatBtcValue(asset.valueUsd, btcPriceUsd)}</div>
                    <div className="text-xs text-muted">{asset.quantity.toFixed(4)} {displaySymbol}</div>
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-body">
                    {formatBtcValue(asset.avgBuyPriceUsd, btcPriceUsd)}
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className={`text-sm font-bold ${positivePnl ? "text-success" : "text-danger"}`}>
                      {formatBtcValue(asset.pnlUsd, btcPriceUsd)}
                    </div>
                    <div className={`flex items-center justify-end gap-1 text-xs ${positivePnl ? "text-success" : "text-danger"}`}>
                      <MaterialIcon
                        name={positivePnl ? "arrow_drop_up" : "arrow_drop_down"}
                        outlined={false}
                        className="text-[10px]"
                      />
                      {Math.abs(asset.pnlPercent).toFixed(2)}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
