"use client";

import { useState } from "react";
import type { OverrideReason, RiskAlertRecord, RiskAlertStatus } from "@/app/lib/risk-types";
import { OVERRIDE_DURATION_OPTIONS, SNOOZE_OPTIONS } from "@/app/lib/risk-types";
import type { OverridePayload } from "@/app/hooks/use-risk-alerts-v2";

type RiskAlertListProps = {
  alerts: RiskAlertRecord[];
  isUpdatingId: string | null;
  onAcknowledge: (alertId: string) => Promise<boolean>;
  onResolve: (alertId: string) => Promise<boolean>;
  onOverride?: (alertId: string, payload: OverridePayload) => Promise<boolean>;   // E1-S1
  onRevokeOverride?: (alertId: string) => Promise<boolean>;                        // E1-S4
  onSnooze?: (alertId: string, minutes: number) => Promise<boolean>;              // E2-S1
  onCancelSnooze?: (alertId: string) => Promise<boolean>;                         // E2-S1
};

export const riskAlertFilters: Array<{ value: RiskAlertStatus | "all"; label: string }> = [
  { value: "all", label: "All alerts" },
  { value: "active", label: "Active" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "snoozed", label: "Snoozed" },
  { value: "overridden", label: "Overridden" },
  { value: "resolved", label: "Resolved" },
];

const OVERRIDE_REASONS: OverrideReason[] = [
  "Taking profit soon",
  "Intentional overweight",
  "Other",
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function severityClass(severity: RiskAlertRecord["severity"]): string {
  if (severity === "critical") return "bg-danger-soft text-danger";
  if (severity === "warning") return "bg-[rgba(255,184,106,0.14)] text-warning";
  return "bg-info-soft text-info";
}

function statusClass(status: RiskAlertStatus): string {
  if (status === "active") return "bg-danger-soft text-danger";
  if (status === "acknowledged") return "bg-[rgba(255,184,106,0.14)] text-warning";
  if (status === "snoozed") return "bg-[rgba(99,179,237,0.18)] text-blue-400";
  if (status === "overridden") return "bg-[rgba(168,132,255,0.18)] text-purple-400";
  return "bg-success-soft text-success";
}

function formatObserved(alert: RiskAlertRecord): string {
  if (alert.observedValue === null || !Number.isFinite(alert.observedValue)) return "N/A";
  return alert.eventType.includes("daily_loss")
    ? `${alert.observedValue.toFixed(2)} USD`
    : `${alert.observedValue.toFixed(2)}%`;
}

function formatThreshold(alert: RiskAlertRecord): string {
  if (alert.thresholdValue === null || !Number.isFinite(alert.thresholdValue)) return "N/A";
  return alert.eventType.includes("daily_loss")
    ? `${alert.thresholdValue.toFixed(2)} USD`
    : `${alert.thresholdValue.toFixed(2)}%`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatOverrideExpiry(alert: RiskAlertRecord): string {
  if (!alert.overrideExpiresAt) return "Until manually revoked";
  return `Expires ${new Date(alert.overrideExpiresAt).toLocaleString()}`;
}

// ─── Override modal ───────────────────────────────────────────────────────────

type OverrideModalProps = {
  alert: RiskAlertRecord;
  isSaving: boolean;
  onConfirm: (payload: OverridePayload) => void;
  onClose: () => void;
};

function OverrideModal({ alert, isSaving, onConfirm, onClose }: OverrideModalProps) {
  const [reason, setReason] = useState<OverrideReason | "">("");
  const [durationIndex, setDurationIndex] = useState(0);

  const selectedDuration = OVERRIDE_DURATION_OPTIONS[durationIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-(--surface-container) p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-strong">Override — I&apos;m holding</h2>
        <p className="mt-1 text-sm text-muted">
          The app will stop re-alerting you on this violation. It will re-alert if the
          violation worsens significantly or your override expires.
        </p>

        {/* Alert summary */}
        <div className="mt-4 rounded-xl bg-(--surface-container-low) px-4 py-3 text-sm">
          <p className="font-semibold text-strong">{alert.title}</p>
          <p className="mt-0.5 text-muted">{formatObserved(alert)} vs threshold {formatThreshold(alert)}</p>
        </div>

        {/* Reason picker */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted uppercase tracking-wide">Reason (optional)</p>
          <div className="flex flex-wrap gap-2">
            {OVERRIDE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r === reason ? "" : r)}
                className={`rounded-xl px-3 py-1.5 text-sm transition-colors ${
                  reason === r
                    ? "bg-primary text-on-primary"
                    : "bg-(--surface-container-low) text-body hover:bg-(--surface-container)"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Duration picker */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted uppercase tracking-wide">Keep overriding for</p>
          <div className="flex flex-wrap gap-2">
            {OVERRIDE_DURATION_OPTIONS.map((opt, i) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setDurationIndex(i)}
                className={`rounded-xl px-3 py-1.5 text-sm transition-colors ${
                  durationIndex === i
                    ? "bg-primary text-on-primary"
                    : "bg-(--surface-container-low) text-body hover:bg-(--surface-container)"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Escalation band notice */}
        <p className="mt-4 text-xs text-muted">
          ⚠ The app will still re-alert if the observed value exceeds{" "}
          <strong className="text-strong">
            {alert.observedValue !== null
              ? `${(alert.observedValue * 1.15).toFixed(2)}${alert.eventType.includes("daily_loss") ? " USD" : "%"}`
              : "115% of current value"}
          </strong>{" "}
          (15% above current violation).
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="ui-button-secondary">
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() =>
              onConfirm({
                reason: reason || undefined,
                expiresInHours: selectedDuration.hours,
              })
            }
            className="ui-button-primary disabled:opacity-60"
          >
            {isSaving ? "Saving\u2026" : `Override until ${selectedDuration.hours ? selectedDuration.label : "revoked"}`}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Snooze menu ──────────────────────────────────────────────────────────────

function SnoozeMenu({ alertId, onSnooze, disabled }: {
  alertId: string;
  onSnooze: (id: string, minutes: number) => Promise<boolean>;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-[rgba(99,179,237,0.4)] bg-[rgba(99,179,237,0.1)] px-3 py-1.5 text-sm text-blue-400 hover:bg-[rgba(99,179,237,0.18)] disabled:opacity-60 transition-colors">
        💤 Snooze
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl bg-(--surface-container) border border-white/10 py-1 shadow-xl">
          {SNOOZE_OPTIONS.map((opt) => (
            <button key={opt.minutes} type="button"
              onClick={() => { void onSnooze(alertId, opt.minutes); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-body hover:bg-(--surface-container-low)">
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main list component ──────────────────────────────────────────────────────

export function RiskAlertList({
  alerts,
  isUpdatingId,
  onAcknowledge,
  onResolve,
  onOverride,
  onRevokeOverride,
  onSnooze,
  onCancelSnooze,
}: RiskAlertListProps) {
  const [overrideTargetId, setOverrideTargetId] = useState<string | null>(null);
  const overrideTarget = alerts.find((a) => a.id === overrideTargetId) ?? null;

  const handleOverrideConfirm = async (payload: OverridePayload) => {
    if (!overrideTargetId) return;
    const ok = onOverride ? await onOverride(overrideTargetId, payload) : false;
    if (ok) setOverrideTargetId(null);
  };

  return (
    <>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <article
            key={alert.id}
            className={`rounded-2xl p-4 ${
              alert.severity === "critical" && alert.status === "active"
                ? "ui-surface-danger-soft"
                : alert.status === "snoozed"
                ? "bg-[rgba(99,179,237,0.06)] border border-[rgba(99,179,237,0.2)]"
                : alert.status === "overridden"
                ? "bg-[rgba(168,132,255,0.08)] border border-[rgba(168,132,255,0.2)]"
                : "bg-(--surface-container-low)"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`status-pill ${severityClass(alert.severity)}`}>{alert.severity}</span>
                  <span className={`status-pill ${statusClass(alert.status)}`}>{alert.status}</span>
                  {alert.symbol && (
                    <span className="status-pill status-pill-neutral">{alert.symbol.replace("USDT", "")}</span>
                  )}
                  {alert.status === "snoozed" && (
                    <span className="status-pill bg-[rgba(99,179,237,0.18)] text-blue-400">💤 Snoozed</span>
                  )}
                  {alert.status === "overridden" && (
                    <span className="status-pill bg-[rgba(168,132,255,0.18)] text-purple-400">
                      🛡 Override active
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-base font-semibold text-strong">{alert.title}</h3>
                <p className="mt-1 text-sm text-body">{alert.message}</p>
                {alert.status === "snoozed" && alert.snoozedUntil && (
                  <div className="mt-2 text-xs text-muted">
                    <span>Re-alerts at <strong className="text-blue-400">{new Date(alert.snoozedUntil).toLocaleTimeString()}</strong></span>
                  </div>
                )}
                {alert.status === "overridden" && (
                  <div className="mt-2 text-xs text-muted">
                    {alert.overrideReason && (
                      <span className="mr-3">Reason: <strong className="text-strong">{alert.overrideReason}</strong></span>
                    )}
                    <span>{alert.overrideExpiresAt ? `Expires ${new Date(alert.overrideExpiresAt).toLocaleString()}` : "Until manually revoked"}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {alert.status === "active" && (
                  <>
                    <button type="button" onClick={() => void onAcknowledge(alert.id)} disabled={isUpdatingId === alert.id} className="ui-button-secondary disabled:opacity-60">
                      {isUpdatingId === alert.id ? "Saving\u2026" : "Acknowledge"}
                    </button>
                    <button type="button" onClick={() => setOverrideTargetId(alert.id)} disabled={isUpdatingId === alert.id}
                      className="rounded-xl border border-[rgba(168,132,255,0.4)] bg-[rgba(168,132,255,0.1)] px-3 py-1.5 text-sm text-purple-400 hover:bg-[rgba(168,132,255,0.18)] disabled:opacity-60 transition-colors">
                      🛡 Override
                    </button>
                  </>
                )}
                {alert.status === "overridden" && (
                  <button type="button" onClick={() => onRevokeOverride && void onRevokeOverride(alert.id)} disabled={isUpdatingId === alert.id} className="ui-button-secondary disabled:opacity-60">
                    {isUpdatingId === alert.id ? "Saving\u2026" : "Revoke override"}
                  </button>
                )}
                {alert.status !== "resolved" && alert.status !== "overridden" && (
                  <button type="button" onClick={() => void onResolve(alert.id)} disabled={isUpdatingId === alert.id} className="ui-button-primary disabled:opacity-60">
                    {isUpdatingId === alert.id ? "Saving\u2026" : "Resolve"}
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
              <div className="rounded-xl bg-(--surface-container) px-3 py-2">
                <span>Observed</span>
                <span className="ml-2 font-semibold text-strong">{formatObserved(alert)}</span>
              </div>
              <div className="rounded-xl bg-(--surface-container) px-3 py-2">
                <span>Threshold</span>
                <span className="ml-2 font-semibold text-strong">{formatThreshold(alert)}</span>
              </div>
              <div className="rounded-xl bg-(--surface-container) px-3 py-2">
                <span>Last triggered</span>
                <span className="ml-2 font-semibold text-strong">{timeAgo(alert.lastTriggeredAt)}</span>
              </div>
              {alert.triggerCount > 1 && (
                <div className="rounded-xl bg-(--surface-container) px-3 py-2 flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-warning/20 text-warning text-[10px] font-bold">
                    ×{alert.triggerCount}
                  </span>
                  <span className="text-warning text-xs font-medium">repeated</span>
                </div>
              )}
              {alert.status === "overridden" && alert.overrideValue !== null && (
                <div className="rounded-xl bg-[rgba(168,132,255,0.1)] px-3 py-2">
                  <span>Override at</span>
                  <span className="ml-2 font-semibold text-purple-400">
                    {alert.eventType.includes("daily_loss") ? `${Number(alert.overrideValue).toFixed(2)} USD` : `${Number(alert.overrideValue).toFixed(2)}%`}
                  </span>
                  <span className="ml-1 text-muted">
                    (re-alerts at {(Number(alert.overrideValue) * 1.15).toFixed(2)}{alert.eventType.includes("daily_loss") ? " USD" : "%"})
                  </span>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {overrideTarget && (
        <OverrideModal
          alert={overrideTarget}
          isSaving={isUpdatingId === overrideTargetId}
          onConfirm={(payload) => void handleOverrideConfirm(payload)}
          onClose={() => setOverrideTargetId(null)}
        />
      )}
    </>
  );
}
