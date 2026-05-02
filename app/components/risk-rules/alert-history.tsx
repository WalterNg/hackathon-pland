"use client";

import { useMemo, useState } from "react";
import type { RiskAlertRecord } from "@/app/lib/risk-types";
import { OVERRIDE_DURATION_OPTIONS, SNOOZE_OPTIONS } from "@/app/lib/risk-types";
import type { OverridePayload } from "@/app/hooks/use-risk-alerts-v2";

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

const OVERRIDE_REASONS = ["Taking profit soon", "Intentional overweight", "Other"] as const;

type OverrideModalProps = {
  alert: RiskAlertRecord;
  isSaving: boolean;
  onConfirm: (payload: OverridePayload) => void;
  onClose: () => void;
};

function OverrideModal({ alert, isSaving, onConfirm, onClose }: OverrideModalProps) {
  const [reason, setReason] = useState("");
  const [durationIndex, setDurationIndex] = useState(0);
  const selectedDuration = OVERRIDE_DURATION_OPTIONS[durationIndex];
  const isUsd = alert.eventType.includes("daily_loss");
  const unit = isUsd ? " USD" : "%";
  const escalationValue = alert.observedValue !== null
    ? `${(Number(alert.observedValue) * 1.15).toFixed(2)}${unit}`
    : `115% of current value`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a2e] p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-strong">🛡 Override — I&apos;m holding</h2>
        <p className="mt-1 text-sm text-muted">
          Suppresses re-alerts for this violation. Will re-alert if it worsens significantly or the override expires.
        </p>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-sm">
          <p className="font-semibold text-strong">{alert.title}</p>
          <p className="mt-0.5 text-muted">
            {alert.observedValue !== null ? `${Number(alert.observedValue).toFixed(2)}${unit}` : "N/A"}{" "}
            vs threshold{" "}
            {alert.thresholdValue !== null ? `${Number(alert.thresholdValue).toFixed(2)}${unit}` : "N/A"}
          </p>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Reason (optional)</p>
          <div className="flex flex-wrap gap-2">
            {OVERRIDE_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r === reason ? "" : r)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  reason === r ? "bg-purple-600/70 text-white" : "border border-white/10 bg-white/5 text-muted hover:text-strong"
                }`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Keep overriding for</p>
          <div className="flex flex-wrap gap-2">
            {OVERRIDE_DURATION_OPTIONS.map((opt, i) => (
              <button key={opt.label} type="button" onClick={() => setDurationIndex(i)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  durationIndex === i ? "bg-purple-600/70 text-white" : "border border-white/10 bg-white/5 text-muted hover:text-strong"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">
          ⚠ Re-alerts automatically if observed value exceeds <strong className="text-strong">{escalationValue}</strong>.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-muted hover:text-strong">
            Cancel
          </button>
          <button type="button" disabled={isSaving}
            onClick={() => onConfirm({ reason: reason || undefined, expiresInHours: selectedDuration.hours })}
            className="rounded-xl bg-purple-600/70 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-600 disabled:opacity-50">
            {isSaving ? "Saving…" : `Override until ${selectedDuration.hours ? selectedDuration.label : "revoked"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

type AlertRowProps = {
  alert: RiskAlertRecord;
  isUpdating: boolean;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onOverride: (id: string, payload: OverridePayload) => void;
  onRevokeOverride: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onCancelSnooze: (id: string) => void;
};

function AlertRow({ alert, isUpdating, onAcknowledge, onResolve, onOverride, onRevokeOverride, onSnooze, onCancelSnooze }: AlertRowProps) {
  const meta = SEVERITY_META[alert.severity] ?? {
    dot: "bg-white/40",
    text: "text-muted",
    bg: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.14)",
  };

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const isOverridden = alert.status === "overridden";
  const isSnoozed = alert.status === "snoozed";
  const isUsd = alert.eventType.includes("daily_loss");
  const unit = isUsd ? " USD" : "%";

  return (
    <>
      <article
        className="rounded-xl border p-4 transition-colors hover:bg-white/2"
        style={{
          borderColor: isOverridden ? "rgba(168,132,255,0.3)" : isSnoozed ? "rgba(99,179,237,0.3)" : "rgba(255,255,255,0.1)",
          background: isOverridden ? "rgba(168,132,255,0.05)" : isSnoozed ? "rgba(99,179,237,0.04)" : "rgba(255,255,255,0.01)",
        }}
      >
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

              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                  isOverridden ? "border-purple-500/35 bg-purple-500/15 text-purple-300"
                  : isSnoozed ? "border-blue-400/35 bg-blue-400/15 text-blue-300"
                  : "border-white/15 bg-white/5 text-muted"
                }`}
              >
                {isOverridden ? "🛡 overridden" : isSnoozed ? "💤 snoozed" : alert.status}
              </span>


            </div>

            <h3 className="text-sm font-semibold text-strong">{alert.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{alert.message}</p>

            {isSnoozed && alert.snoozedUntil && (
              <div className="mt-2 text-xs text-muted">
                <span>Re-alerts at <strong className="text-blue-300">{new Date(alert.snoozedUntil).toLocaleTimeString()}</strong></span>
              </div>
            )}
            {isOverridden && (
              <div className="mt-2 text-xs text-muted">
                {alert.overrideReason && <span className="mr-3">Reason: <strong className="text-purple-300">{alert.overrideReason}</strong></span>}
                <span>{alert.overrideExpiresAt ? `Expires ${new Date(alert.overrideExpiresAt).toLocaleString()}` : "Until manually revoked"}</span>
                {alert.overrideValue !== null && (
                  <span className="ml-3">
                    Re-alerts at <strong className="text-purple-300">{(Number(alert.overrideValue) * 1.15).toFixed(2)}{unit}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="text-xs text-muted">{timeAgo(alert.lastTriggeredAt)}</div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {alert.status === "active" && (
            <>
              <button type="button" disabled={isUpdating} onClick={() => onAcknowledge(alert.id)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-white/25 hover:text-strong disabled:cursor-not-allowed disabled:opacity-45">
                <span className="material-icons-outlined text-sm">notifications_paused</span>
                Acknowledge
              </button>
              <button type="button" disabled={isUpdating} onClick={() => setShowOverrideModal(true)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-purple-500/35 bg-purple-500/15 px-3 py-1.5 text-xs font-semibold text-purple-300 transition-colors hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-45">
                🛡 Override
              </button>
            </>
          )}

          {isOverridden && (
            <button type="button" disabled={isUpdating} onClick={() => onRevokeOverride(alert.id)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-white/25 hover:text-strong disabled:cursor-not-allowed disabled:opacity-45">
              Revoke override
            </button>
          )}

          {(alert.status === "active" || alert.status === "acknowledged") && (
            <button type="button" disabled={isUpdating} onClick={() => onResolve(alert.id)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-success/35 bg-success/15 px-3 py-1.5 text-xs font-semibold text-success transition-colors hover:bg-success/20 disabled:cursor-not-allowed disabled:opacity-45">
              <span className="material-icons-outlined text-sm">task_alt</span>
              Resolve
            </button>
          )}
        </div>
      </article>

      {showOverrideModal && (
        <OverrideModal
          alert={alert}
          isSaving={isUpdating}
          onConfirm={(payload) => { onOverride(alert.id, payload); setShowOverrideModal(false); }}
          onClose={() => setShowOverrideModal(false)}
        />
      )}
    </>
  );
}

type Props = {
  alerts: RiskAlertRecord[];
  isLoading: boolean;
  isUpdatingId: string | null;
  error: string | null;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onOverride: (id: string, payload: OverridePayload) => void;
  onRevokeOverride: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onCancelSnooze: (id: string) => void;
};

type TabFilter = "all" | "active" | "acknowledged" | "overridden" | "resolved";

export function AlertHistory({
  alerts,
  isLoading,
  isUpdatingId,
  error,
  onAcknowledge,
  onResolve,
  onOverride,
  onRevokeOverride,
  onSnooze,
  onCancelSnooze,
}: Props) {
  const [tab, setTab] = useState<TabFilter>("all");

  const counts = useMemo(
    () => ({
      all: alerts.length,
      active: alerts.filter((a) => a.status === "active").length,
      acknowledged: alerts.filter((a) => a.status === "acknowledged").length,
      snoozed: alerts.filter((a) => a.status === "snoozed").length,
      overridden: alerts.filter((a) => a.status === "overridden").length,
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

        <div className="inline-flex rounded-xl border border-white/10 bg-white/2 p-1">
          {(["all", "active", "acknowledged", "snoozed", "overridden", "resolved"] as TabFilter[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                tab === t ? "bg-white/10 text-strong" : "text-muted hover:text-strong"
              }`}>
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
        <div className="rounded-xl border border-white/10 bg-white/1.5 py-12 text-center">
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
            <AlertRow key={alert.id} alert={alert} isUpdating={isUpdatingId === alert.id}
              onAcknowledge={onAcknowledge} onResolve={onResolve}
              onOverride={onOverride} onRevokeOverride={onRevokeOverride}
              onSnooze={onSnooze} onCancelSnooze={onCancelSnooze} />
          ))}
        </div>
      )}
    </section>
  );
}
