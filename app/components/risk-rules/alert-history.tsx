"use client";

import { useMemo, useState } from "react";
import type { RiskAlertRecord } from "@/app/lib/risk-types";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const SEVERITY_META: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  critical: {
    dot: "bg-red-500",
    text: "text-red-300",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.25)",
  },
  warning: {
    dot: "bg-orange-400",
    text: "text-orange-200",
    bg: "rgba(251,146,60,0.1)",
    border: "rgba(251,146,60,0.22)",
  },
  info: {
    dot: "bg-blue-400",
    text: "text-blue-200",
    bg: "rgba(96,165,250,0.1)",
    border: "rgba(96,165,250,0.25)",
  },
};

type AlertRowProps = {
  alert: RiskAlertRecord;
  isUpdating: boolean;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
};

function AlertRow({ alert, isUpdating, onAcknowledge, onResolve }: AlertRowProps) {
  const meta = SEVERITY_META[alert.severity] ?? {
    dot: "bg-white/40",
    text: "text-muted",
    bg: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.14)",
  };

  return (
    <article className="rounded-xl border p-4 transition-colors hover:bg-white/[0.02]" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.01)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${meta.text}`}
              style={{ background: meta.bg, borderColor: meta.border }}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {alert.severity}
            </span>

            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {alert.status}
            </span>

            {alert.triggerCount > 1 && (
              <span className="text-xs text-muted">Triggered {alert.triggerCount} times</span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-strong">{alert.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{alert.message}</p>
        </div>

        <div className="text-xs text-muted">{timeAgo(alert.lastTriggeredAt)}</div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {alert.status === "active" && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onAcknowledge(alert.id)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-white/25 hover:text-strong disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="material-icons-outlined text-sm">notifications_paused</span>
            Acknowledge
          </button>
        )}

        {(alert.status === "active" || alert.status === "acknowledged") && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onResolve(alert.id)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-success/35 bg-success/15 px-3 py-1.5 text-xs font-semibold text-success transition-colors hover:bg-success/20 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="material-icons-outlined text-sm">task_alt</span>
            Resolve
          </button>
        )}
      </div>
    </article>
  );
}

type Props = {
  alerts: RiskAlertRecord[];
  isLoading: boolean;
  isUpdatingId: string | null;
  error: string | null;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
};

type TabFilter = "all" | "active" | "acknowledged" | "resolved";

export function AlertHistory({
  alerts,
  isLoading,
  isUpdatingId,
  error,
  onAcknowledge,
  onResolve,
}: Props) {
  const [tab, setTab] = useState<TabFilter>("all");

  const counts = useMemo(
    () => ({
      all: alerts.length,
      active: alerts.filter((a) => a.status === "active").length,
      acknowledged: alerts.filter((a) => a.status === "acknowledged").length,
      resolved: alerts.filter((a) => a.status === "resolved").length,
    }),
    [alerts]
  );

  const filtered = tab === "all" ? alerts : alerts.filter((a) => a.status === tab);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-strong">Alert Activity</h2>
          <p className="mt-1 text-sm text-muted">Track breaches and resolve risk events quickly.</p>
        </div>

        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.02] p-1">
          {(["all", "active", "acknowledged", "resolved"] as TabFilter[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                tab === t ? "bg-white/10 text-strong" : "text-muted hover:text-strong"
              }`}
            >
              {t} ({counts[t]})
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="flex items-center gap-1 rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
          <span className="material-icons-outlined text-sm">error</span>
          {error}
        </p>
      ) : isLoading ? (
        <div className="space-y-3 py-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.015] py-12 text-center">
          <p className="mb-2 text-sm font-semibold text-strong">No {tab === "all" ? "alerts" : tab} items</p>
          <p className="text-sm text-muted">
            {tab === "all"
              ? "Everything is quiet. Alerts will appear here when a threshold is breached."
              : `No ${tab} alerts right now.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              isUpdating={isUpdatingId === alert.id}
              onAcknowledge={onAcknowledge}
              onResolve={onResolve}
            />
          ))}
        </div>
      )}
    </section>
  );
}
