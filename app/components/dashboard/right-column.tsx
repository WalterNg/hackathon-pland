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
    iconBg: "bg-gray-100 dark:bg-gray-700",
    iconText: "text-gray-500 dark:text-gray-300",
    outlined: true
  },
  {
    title: "Deposited Funds",
    detail: "$200 on Sep 20, 2022",
    icon: "account_balance_wallet",
    iconBg: "bg-teal-100 dark:bg-teal-900/50",
    iconText: "text-teal-600 dark:text-teal-400",
    outlined: true
  }
];

const assets = [
  { name: "Bitcoin", symbol: "BTC", icon: "currency_bitcoin", iconBg: "bg-orange-100", iconText: "text-orange-500", outlined: false },
  { name: "Ethereum", symbol: "ETH", icon: "token", iconBg: "bg-indigo-100", iconText: "text-indigo-800", outlined: false },
  { name: "IoT Chain", symbol: "ITC", icon: "hub", iconBg: "bg-blue-900", iconText: "text-white", outlined: true },
  { name: "Dogecoin", symbol: "DOGE", iconText: "text-white", iconBg: "bg-yellow-400", fallback: "Đ" },
  { name: "Digibyte", symbol: "DGB", iconText: "text-white", iconBg: "bg-blue-500", fallback: "D" },
  { name: "Litecoin", symbol: "LTE", icon: "L", iconText: "text-gray-500 dark:text-gray-400", iconBg: "bg-gray-200 dark:bg-gray-700", outlined: false }
];

export function RightColumn() {
  return (
    <div className="space-y-6 lg:col-span-4">
      <div className="rounded-2xl bg-mint-card p-6 shadow-soft dark:bg-gray-800">
        <h3 className="mb-6 text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white">Recent Transaction</h3>
        <div className="space-y-6">
          {transactions.map((item) => (
            <div key={item.title} className="flex items-center gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.iconBg} ${item.iconText}`}>
                <MaterialIcon name={item.icon} outlined={item.outlined} className="text-xl" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">{item.title}</div>
                <div className="mt-0.5 text-[11px] text-gray-500">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-card-light p-6 shadow-soft dark:bg-card-dark">
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
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{asset.name}</div>
                  <div className="mt-0.5 text-xs text-gray-500">{asset.symbol}</div>
                </div>
              </div>
            </div>
          ))}

          <div className="group flex cursor-pointer items-center justify-between pt-2">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-mint-card text-teal-700 dark:bg-teal-900/40 dark:text-teal-400">
                <MaterialIcon name="add" outlined={false} className="text-xl" />
              </div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">Add Assets</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl bg-mint-card p-6 text-center shadow-soft dark:bg-gray-800">
        <h3 className="mb-6 w-full text-left text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white">Your Credit Score</h3>
        <div className="relative mt-2 mb-6 h-24 w-48 overflow-hidden">
          <div className="absolute left-0 top-0 box-border h-48 w-48 rounded-full border-14 border-black dark:border-gray-700" />
          <div className="absolute left-0 top-0 box-border h-48 w-48 -rotate-45 transform rounded-full border-14 border-b-transparent border-l-transparent border-white dark:border-gray-300" />
          <div className="absolute bottom-1 right-[12%] z-10 h-5 w-5 rounded-full border-4 border-black bg-white dark:border-white dark:bg-gray-800" />
        </div>
        <div className="relative -mt-6 mb-2">
          <h2 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white">990</h2>
        </div>
        <p className="mt-1 text-xs font-semibold text-gray-800 dark:text-gray-200">Your Credit Score is average</p>
        <p className="mb-5 text-[10px] text-gray-500">Last Check on 21 Apr</p>
        <button className="rounded-lg border border-white bg-white/80 px-5 py-2.5 text-xs font-medium text-gray-600 shadow-sm backdrop-blur-sm dark:border-gray-600 dark:bg-gray-700/80 dark:text-gray-300">
          What these stats mean?
        </button>
      </div>
    </div>
  );
}
