import { useMemo, useState } from "react";
import type { PortfolioAssetRow } from "@/app/lib/portfolio-types";
import { MaterialIcon } from "../dashboard/material-icon";
import { getFullCoinName } from "@/app/lib/coin-names";
import { formatLocaleNumber } from "@/app/lib/number-format";

type PortfolioAssetsTableProps = {
  assets: PortfolioAssetRow[];
};

const usdValueFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const formatUsdValue = (usdValue: number) => {
  if (!Number.isFinite(usdValue)) {
    return "N/A";
  }

  return usdValueFormatter.format(usdValue);
};

const formatPriceValue = (price: number) => {
  if (!Number.isFinite(price)) return "N/A";
  
  // Dynamic decimals for price: 2 if >= 1, otherwise up to 4 or 6
  const maxDecimals = price >= 1 ? 2 : price >= 0.01 ? 4 : 6;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: 0
  }).format(price);
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

type SortField = keyof PortfolioAssetRow;
type SortDirection = "asc" | "desc" | null;

export function PortfolioAssetsTable({ assets }: PortfolioAssetsTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "desc") setSortDirection("asc");
      else if (sortDirection === "asc") {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedAssets = useMemo(() => {
    if (!sortField || !sortDirection) return assets;

    return [...assets].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortDirection === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return 0;
    });
  }, [assets, sortField, sortDirection]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <MaterialIcon name="unfold_more" outlined={false} className="ml-1 text-[10px] text-muted/30" />;
    }
    return (
      <MaterialIcon
        name={sortDirection === "asc" ? "expand_less" : "expand_more"}
        outlined={false}
        className="ml-1 text-[10px] text-primary"
      />
    );
  };
  return (
    <section className="panel-base mb-6 overflow-hidden lg:mb-8">
      <div className="p-5 sm:p-6">
        <h3 className="section-title">Assets</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="text-[10px] font-bold uppercase tracking-widest text-muted">
            <tr>
              <th className="cursor-pointer px-6 py-4 transition-colors hover:text-strong" onClick={() => handleSort("symbol")}>
                <div className="flex items-center">
                  Name {renderSortIcon("symbol")}
                </div>
              </th>
              <th className="cursor-pointer px-6 py-4 text-right transition-colors hover:text-strong" onClick={() => handleSort("priceUsd")}>
                <div className="flex items-center justify-end">
                  Price {renderSortIcon("priceUsd")}
                </div>
              </th>
              <th className="px-6 py-4 text-right">1h%</th>
              <th className="cursor-pointer px-6 py-4 text-right transition-colors hover:text-strong" onClick={() => handleSort("change24hPercent")}>
                <div className="flex items-center justify-end">
                  24h% {renderSortIcon("change24hPercent")}
                </div>
              </th>
              <th className="cursor-pointer px-6 py-4 text-right transition-colors hover:text-strong" onClick={() => handleSort("change7dPercent")}>
                <div className="flex items-center justify-end">
                  7d% {renderSortIcon("change7dPercent")}
                </div>
              </th>
              <th className="cursor-pointer px-6 py-4 text-right transition-colors hover:text-strong" onClick={() => handleSort("valueUsd")}>
                <div className="flex items-center justify-end">
                  Holdings {renderSortIcon("valueUsd")}
                </div>
              </th>
              <th className="cursor-pointer px-6 py-4 text-right transition-colors hover:text-strong" onClick={() => handleSort("avgBuyPriceUsd")}>
                <div className="flex items-center justify-end">
                  Avg. Buy Price {renderSortIcon("avgBuyPriceUsd")}
                </div>
              </th>
              <th className="cursor-pointer px-6 py-4 text-right transition-colors hover:text-strong" onClick={() => handleSort("pnlUsd")}>
                <div className="flex items-center justify-end">
                  Profit/Loss {renderSortIcon("pnlUsd")}
                </div>
              </th>
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

            {sortedAssets.map((asset) => {
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
                        <div className="text-xs text-muted font-medium">{displaySymbol}</div>
                      </div>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-strong">
                    {formatPriceValue(asset.priceUsd)}
                  </td>

                  <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-semibold ${positive1h ? "text-success" : "text-danger"}`}>
                    <span className="flex items-center justify-end gap-0.5">
                      <MaterialIcon name={positive1h ? "arrow_drop_up" : "arrow_drop_down"} outlined={false} className="text-[12px]" />
                      {Math.abs(change1hPercent).toFixed(2)}%
                    </span>
                  </td>

                  <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-semibold ${positive24h ? "text-success" : "text-danger"}`}>
                    <span className="flex items-center justify-end gap-0.5">
                      <MaterialIcon name={positive24h ? "arrow_drop_up" : "arrow_drop_down"} outlined={false} className="text-[12px]" />
                      {Math.abs(asset.change24hPercent).toFixed(2)}%
                    </span>
                  </td>

                  <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-semibold ${positive7d ? "text-success" : "text-danger"}`}>
                    <span className="flex items-center justify-end gap-0.5">
                      <MaterialIcon name={positive7d ? "arrow_drop_up" : "arrow_drop_down"} outlined={false} className="text-[12px]" />
                      {Math.abs(change7dPercent).toFixed(2)}%
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="text-sm font-bold text-strong">{formatUsdValue(asset.valueUsd)}</div>
                    <div className="text-[11px] font-medium text-muted">{formatLocaleNumber(asset.quantity, { maximumFractionDigits: 8 })} {displaySymbol}</div>
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-strong">
                    {formatPriceValue(asset.avgBuyPriceUsd)}
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className={`text-sm font-bold ${positivePnl ? "text-success" : "text-danger"}`}>
                      {positivePnl ? "+" : ""}{formatUsdValue(asset.pnlUsd)}
                    </div>
                    <div className={`flex items-center justify-end gap-0.5 text-[11px] font-semibold ${positivePnl ? "text-success" : "text-danger"}`}>
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
