import { MaterialIcon } from "../dashboard/material-icon";
import type { JournalSummaryPayload, JournalTradeItem } from "@/app/lib/journal-types";

type JournalActivityProps = {
  summary: JournalSummaryPayload | null;
  isLoading: boolean;
};

function formatBtc(value: number | null | undefined, fractionDigits = 8): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(fractionDigits)} BTC`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

function toTradeRow(item: JournalTradeItem) {
  const date = new Date(item.executedAt);
  const isDateValid = !Number.isNaN(date.getTime());
  const pnl = item.pnlBtc;

  return {
    id: item.id,
    date: isDateValid ? dateFormatter.format(date) : item.executedAt,
    pair: item.pair,
    symbol: item.pair.slice(0, 1).toUpperCase(),
    side: item.side.toUpperCase(),
    entry: formatBtc(item.entryPriceBtc),
    exit: formatBtc(item.exitPriceBtc),
    pnl: formatBtc(pnl),
    profit: pnl !== null ? pnl >= 0 : false
  };
}

function sideBadgeClass(side: string): string {
  if (side === "LONG" || side === "BUY" || side === "DEPOSIT") {
    return "bg-success-soft text-success";
  }

  if (side === "SHORT" || side === "SELL" || side === "WITHDRAWAL") {
    return "bg-danger-soft text-danger";
  }

  return "bg-info-soft text-info";
}

export function JournalActivity({ summary, isLoading }: JournalActivityProps) {
  const trades = (summary?.trades ?? []).map(toTradeRow);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4 sm:pr-1">
      <div className="flex min-h-75 flex-1 flex-col overflow-hidden rounded-2xl bg-card-light shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <h3 className="text-lg font-bold text-strong">Trade Logs</h3>
          <div className="flex space-x-2">
            <input type="text" placeholder="Search pair..." className="w-32 rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-body focus:ring-1 focus:ring-primary sm:w-40" />
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
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted">
                    Loading trade logs...
                  </td>
                </tr>
              )}

              {!isLoading && trades.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted">
                    No journal entries found.
                  </td>
                </tr>
              )}

              {trades.map((trade) => (
                <tr key={trade.id} className="group transition-colors hover:bg-gray-50">
                  <td className="px-6 py-4 text-muted">{trade.date}</td>
                  <td className="flex items-center gap-2 px-6 py-4 font-medium text-strong">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/30 text-xs font-bold text-on-primary">{trade.symbol}</div>
                    {trade.pair}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${sideBadgeClass(trade.side)}`}>
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
