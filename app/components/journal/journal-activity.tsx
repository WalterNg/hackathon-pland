import { MaterialIcon } from "../dashboard/material-icon";

type Trade = {
  date: string;
  pair: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entry: string;
  exit: string;
  pnl: string;
  profit: boolean;
};

const trades: Trade[] = [
  { date: "Oct 24, 14:30", pair: "BTC/USDT", symbol: "₿", side: "LONG", entry: "$34,200", exit: "$35,100", pnl: "+$900.00", profit: true },
  { date: "Oct 23, 09:15", pair: "ETH/USDT", symbol: "Ξ", side: "SHORT", entry: "$1,850", exit: "$1,820", pnl: "+$450.00", profit: true },
  { date: "Oct 22, 16:45", pair: "SOL/USDT", symbol: "S", side: "LONG", entry: "$32.50", exit: "$31.80", pnl: "-$140.00", profit: false },
  { date: "Oct 21, 11:20", pair: "BNB/USDT", symbol: "B", side: "LONG", entry: "$215.00", exit: "$222.00", pnl: "+$210.00", profit: true }
];

export function JournalActivity() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1 pb-4">
      <div className="rounded-2xl bg-card-light p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-strong">Daily Performance</h3>
          <div className="flex space-x-2">
            <button className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-muted">Week</button>
            <button className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-on-primary">Month</button>
          </div>
        </div>

        <div className="grid h-48 grid-cols-7 items-end gap-2">
          {[58, 72, 35, 46, 40, 42, 68].map((height, index) => (
            <div key={index} className="relative flex h-full items-end">
              <div className="w-full rounded-md bg-primary" style={{ height: `${height}%` }} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-75 flex-1 flex-col overflow-hidden rounded-2xl bg-card-light shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h3 className="text-lg font-bold text-strong">Trade Logs</h3>
          <div className="flex space-x-2">
            <input type="text" placeholder="Search pair..." className="w-40 rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-body focus:ring-1 focus:ring-primary" />
            <button className="text-muted transition hover:text-body">
              <MaterialIcon name="filter_list" className="text-lg" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-primary/20 text-xs uppercase tracking-wider text-muted">
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Pair</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 text-right font-semibold">Entry</th>
                <th className="px-6 py-4 text-right font-semibold">Exit</th>
                <th className="px-6 py-4 text-right font-semibold">P&L</th>
                <th className="px-6 py-4 text-center font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {trades.map((trade) => (
                <tr key={`${trade.date}-${trade.pair}`} className="group transition-colors hover:bg-gray-50">
                  <td className="px-6 py-4 text-muted">{trade.date}</td>
                  <td className="flex items-center gap-2 px-6 py-4 font-medium text-strong">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/30 text-xs font-bold text-on-primary">{trade.symbol}</div>
                    {trade.pair}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${trade.side === "LONG" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                      {trade.side}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-body">{trade.entry}</td>
                  <td className="px-6 py-4 text-right text-body">{trade.exit}</td>
                  <td className={`px-6 py-4 text-right font-medium ${trade.profit ? "text-success" : "text-danger"}`}>{trade.pnl}</td>
                  <td className="px-6 py-4 text-center">
                    <button className="text-muted transition-colors hover:text-primary">
                      <MaterialIcon name="visibility" className="text-lg" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
