import { MaterialIcon } from "./material-icon";

const transactions = [
  {
    title: "Received Bitcoin",
    detail: "+0.00045734 BTC on Oct 1, 2022",
    icon: "currency_bitcoin",
    iconBg: "bg-orange-100",
    iconText: "text-orange-500",
    outlined: false
  },
  {
    title: "Received Ethereum",
    detail: "+0.00034576 ETH on Sep 29, 2022",
    icon: "token",
    iconBg: "bg-gray-100",
    iconText: "text-muted",
    outlined: true
  },
  {
    title: "Deposited Funds",
    detail: "$200 on Sep 20, 2022",
    icon: "account_balance_wallet",
    iconBg: "bg-teal-100",
    iconText: "text-accent",
    outlined: true
  }
];

const assets = [
  { name: "Bitcoin", symbol: "BTC", icon: "currency_bitcoin", iconBg: "bg-orange-100", iconText: "text-orange-500", outlined: false },
  { name: "Ethereum", symbol: "ETH", icon: "token", iconBg: "bg-indigo-100", iconText: "text-indigo-800", outlined: false },
  { name: "IoT Chain", symbol: "ITC", icon: "hub", iconBg: "bg-blue-900", iconText: "text-inverse", outlined: true },
  { name: "Dogecoin", symbol: "DOGE", iconText: "text-inverse", iconBg: "bg-yellow-400", fallback: "Đ" },
  { name: "Digibyte", symbol: "DGB", iconText: "text-inverse", iconBg: "bg-blue-500", fallback: "D" },
  { name: "Litecoin", symbol: "LTE", icon: "L", iconText: "text-muted", iconBg: "bg-gray-200", outlined: false }
];

export function RightColumn() {
  return (
    <div className="space-y-6 lg:col-span-4">
      <div className="rounded-2xl bg-mint-card p-6 shadow-soft">
        <h3 className="typo-section text-strong mb-6">Recent Transaction</h3>
        <div className="space-y-6">
          {transactions.map((item) => (
            <div key={item.title} className="flex items-center gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.iconBg} ${item.iconText}`}>
                <MaterialIcon name={item.icon} outlined={item.outlined} className="text-xl" />
              </div>
              <div>
                <div className="typo-body-sm text-strong font-bold">{item.title}</div>
                <div className="text-muted typo-caption mt-0.5">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-h-82 overflow-y-auto rounded-2xl bg-card-light p-6 shadow-soft">
        <div className="space-y-6">
          {assets.map((asset) => (
            <div key={asset.name} className="group flex cursor-pointer items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${asset.iconBg} ${asset.iconText}`}>
                  {asset.fallback ? (
                    <span className={asset.fallback === "D" ? "text-lg font-bold italic" : "text-lg font-bold"}>{asset.fallback}</span>
                  ) : (
                    <MaterialIcon name={asset.icon ?? ""} outlined={asset.outlined} className="text-xl" />
                  )}
                </div>
                <div>
                  <div className="typo-body-sm text-strong font-bold">{asset.name}</div>
                  <div className="text-muted typo-body-xs mt-0.5">{asset.symbol}</div>
                </div>
              </div>
            </div>
          ))}

          <div className="group flex cursor-pointer items-center justify-between pt-2">
            <div className="flex items-center gap-4">
              <div className="text-accent flex h-10 w-10 items-center justify-center rounded-lg bg-mint-card">
                <MaterialIcon name="add" outlined={false} className="text-xl" />
              </div>
              <div className="typo-body-sm text-strong font-bold">Add Assets</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
