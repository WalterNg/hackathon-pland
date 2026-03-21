import { MaterialIcon } from "../dashboard/material-icon";
import type { JournalSummaryPayload } from "@/app/lib/journal-types";

type JournalInsightsProps = {
  summary: JournalSummaryPayload | null;
  isLoading: boolean;
};

const distributionColors = ["bg-primary", "bg-info", "bg-sidebar-dark"];

export function JournalInsights({ summary, isLoading }: JournalInsightsProps) {
  const distribution = summary?.distribution ?? [];
  const emotions = summary?.emotions ?? [];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto pb-4 lg:min-w-75">
      <section className="panel-base p-5 sm:p-6">
        <div className="eyebrow mb-2">Composition</div>
        <h3 className="mb-4 self-start section-title">Trade Distribution</h3>

        <div className="relative mx-auto h-48 w-48">
          <div className="h-full w-full rounded-full bg-distribution-ring" />
          <div className="absolute inset-6 rounded-full bg-card-light" />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-strong">{summary?.totalTrades ?? 0}</span>
            <span className="text-xs text-muted">Total Trades</span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading && <div className="text-sm text-muted">Loading distribution...</div>}
          {!isLoading && distribution.length === 0 && <div className="text-sm text-muted">No distribution data.</div>}

          {distribution.map((item, index) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${distributionColors[index] ?? "bg-gray-400"}`} />
                <span className="text-body">{item.label}</span>
              </div>
              <span className="font-semibold text-strong">{item.percent.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-high p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="eyebrow mb-2">Reflection</div>
            <h3 className="section-title">Mental State</h3>
          </div>
          <MaterialIcon name="psychology" className="text-primary" />
        </div>

        <div className="space-y-4">
          {isLoading && <div className="text-sm text-muted">Loading emotions...</div>}
          {!isLoading && emotions.length === 0 && <div className="text-sm text-muted">No emotion data.</div>}

          {emotions.map((state) => (
            <div key={state.label} className="flex items-center justify-between rounded-xl bg-(--surface-container) p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🧠</span>
                <div>
                  <p className="text-sm font-semibold text-strong">{state.label}</p>
                  <p className="text-xs text-muted">{state.trades} trades</p>
                </div>
              </div>
              <span className={`text-sm font-bold ${(state.winRate ?? 0) >= 50 ? "text-success" : "text-danger"}`}>
                {state.winRate !== null ? `${state.winRate.toFixed(2)}% Win` : "N/A"}
              </span>
            </div>
          ))}
        </div>

        <button className="ui-button-secondary mt-4 w-full justify-center">
          View Detailed Analysis
        </button>
      </section>
    </div>
  );
}
