import { MaterialIcon } from "../dashboard/material-icon";
import type { JournalSummaryPayload } from "@/app/lib/journal-types";

type JournalKpisProps = {
  summary: JournalSummaryPayload | null;
  isLoading: boolean;
};

function formatBtc(value: number | null | undefined, fractionDigits = 6): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(fractionDigits)} BTC`;
}

export function JournalKpis({ summary, isLoading }: JournalKpisProps) {
  const winRate = summary?.kpis.winRate;
  const pnlBtc = summary?.kpis.netPnlBtc ?? 0;

  const kpis = [
    {
      title: "Win Rate",
      value: winRate !== null && winRate !== undefined ? `${winRate.toFixed(2)}%` : "N/A",
      progress: winRate ?? 0,
      subtitle: "Closed trades win ratio",
      icon: "emoji_events"
    },
    {
      title: "Profit/Loss",
      value: formatBtc(pnlBtc),
      subtitle: `Net P&L (${summary?.range.days ?? 30} days)`,
      progress: 0,
      icon: "attach_money"
    }
  ];

  return (
    <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
      {kpis.map((kpi) => (
        <article key={kpi.title} className="group relative flex flex-col justify-between overflow-hidden rounded-[1.35rem] bg-sidebar-dark p-5 text-inverse shadow-[0_24px_60px_rgba(0,0,0,0.34)] sm:p-6">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 transform opacity-5 transition-transform group-hover:scale-110">
            <MaterialIcon name={kpi.icon} className="text-9xl" />
          </div>

          <div className="z-10">
            <h3 className="eyebrow text-subtle">{kpi.title}</h3>
          </div>

          <div className="z-10 mt-4">
            <span className="typo-metric">{kpi.value}</span>
            {kpi.title === "Win Rate" ? (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, kpi.progress))}%` }} />
              </div>
            ) : (
              <p className="mt-2 text-xs text-subtle">{kpi.subtitle}</p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
