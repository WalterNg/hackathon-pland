import type { DashboardRecentTransaction, PortfolioAssetRow } from "@/app/lib/portfolio-types";
import { useDashboardTransactions } from "@/app/hooks/use-dashboard-transactions";
import { MaterialIcon } from "./material-icon";

type RightColumnProps = {
  assets: PortfolioAssetRow[];
  portfolioName: string;
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

export function RightColumn({ assets, portfolioName }: RightColumnProps) {
  const { transactions, isLoading: isTransactionsLoading } = useDashboardTransactions(portfolioName, 5);
  const topAssets = assets.slice(0, 6);

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  const mapTransactionDisplay = (item: DashboardRecentTransaction) => {
    const token = item.symbol.replace("USDT", "");
    const date = new Date(item.executedAt);
    const dateLabel = Number.isNaN(date.getTime()) ? item.executedAt : dateFormatter.format(date);

    if (item.side === "buy") {
      return {
        title: `Bought ${token}`,
        detail: `+${item.quantity.toFixed(6)} ${token} on ${dateLabel}`,
        icon: "add_shopping_cart",
        iconBg: "bg-teal-100",
        iconText: "text-accent"
      };
    }

    if (item.side === "sell") {
      return {
        title: `Sold ${token}`,
        detail: `-${item.quantity.toFixed(6)} ${token} on ${dateLabel}`,
        icon: "sell",
        iconBg: "bg-red-100",
        iconText: "text-danger"
      };
    }

    if (item.side === "deposit") {
      return {
        title: `Transfer In ${token}`,
        detail: `+${item.quantity.toFixed(6)} ${token} on ${dateLabel}`,
        icon: "south_west",
        iconBg: "bg-blue-100",
        iconText: "text-primary"
      };
    }

    return {
      title: `Transfer Out ${token}`,
      detail: `-${item.quantity.toFixed(6)} ${token} on ${dateLabel}`,
      icon: "north_east",
      iconBg: "bg-gray-100",
      iconText: "text-muted"
    };
  };

  return (
    <div className="space-y-4 lg:col-span-4 lg:space-y-6">
      <div className="rounded-2xl bg-mint-card p-5 shadow-soft sm:p-6">
        <h3 className="typo-section text-strong mb-6">Recent Transaction</h3>
        <div className="space-y-6">
          {isTransactionsLoading && <div className="text-muted typo-caption">Loading transactions…</div>}

          {!isTransactionsLoading && transactions.length === 0 && (
            <div className="text-muted typo-caption">No transactions yet.</div>
          )}

          {!isTransactionsLoading &&
            transactions.map((transaction) => {
              const item = mapTransactionDisplay(transaction);

              return (
                <div key={transaction.id} className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.iconBg} ${item.iconText}`}>
                    <MaterialIcon name={item.icon} outlined={false} className="text-xl" />
                  </div>
                  <div>
                    <div className="typo-body-sm text-strong font-bold">{item.title}</div>
                    <div className="text-muted typo-caption mt-0.5">{item.detail}</div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div className="max-h-82 overflow-y-auto rounded-2xl bg-card-light p-5 shadow-soft sm:p-6">
        <div className="space-y-6">
          {topAssets.map((asset) => (
            <div key={asset.symbol} className="group flex cursor-pointer items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-500">
                  <MaterialIcon name="currency_bitcoin" outlined={false} className="text-xl" />
                </div>
                <div>
                  <div className="typo-body-sm text-strong font-bold">{asset.symbol.replace("USDT", "")}</div>
                  <div className="text-muted typo-body-xs mt-0.5">{usdFormatter.format(asset.valueUsd)}</div>
                </div>
              </div>

              <div className={`typo-body-xs font-semibold ${asset.change24hPercent >= 0 ? "text-success" : "text-danger"}`}>
                {asset.change24hPercent >= 0 ? "+" : ""}
                {asset.change24hPercent.toFixed(2)}%
              </div>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}
