"use client";

import { useMemo, useState } from "react";
import type { RiskAlertRecord, RiskAlertStatus, OverrideReason } from "@/app/lib/risk-types";
import { OVERRIDE_DURATION_OPTIONS, SNOOZE_OPTIONS } from "@/app/lib/risk-types";
import type { OverridePayload } from "@/app/hooks/use-risk-alerts-v2";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 6;

const STATUS_FILTERS: Array<{ value: RiskAlertStatus | "all"; label: string }> = [
  { value: "all",        label: "All"       },
  { value: "active",     label: "Active"    },
  { value: "snoozed",    label: "Snoozed"   },
  { value: "overridden", label: "Overridden"},
  { value: "resolved",   label: "Resolved"  },
];

const OVERRIDE_REASONS: OverrideReason[] = [
  "Taking profit soon",
  "Intentional overweight",
  "Other",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "unknown";

  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "unknown";

  const diffMs = timestamp - Date.now();
  const diffMinutes = Math.floor(Math.abs(diffMs) / 60_000);

  if (diffMinutes < 1) {
    return diffMs >= 0 ? "in <1m" : "just now";
  }

  if (diffMinutes < 60) {
    return diffMs >= 0 ? `in ${diffMinutes}m` : `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffMs >= 0 ? `in ${diffHours}h` : `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return diffMs >= 0 ? `in ${diffDays}d` : `${diffDays}d ago`;
}

function fmtValue(v: number | null, eventType: string): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return eventType.includes("daily_loss") ? `$${v.toFixed(2)}` : `${v.toFixed(2)}%`;
}

// ─── Override modal ────────────────────────────────────────────────────────────

type OverrideModalProps = {
  alert: RiskAlertRecord;
  isSaving: boolean;
  onConfirm: (p: OverridePayload) => void;
  onClose: () => void;
};

function OverrideModal({ alert, isSaving, onConfirm, onClose }: OverrideModalProps) {
  const [reason, setReason] = useState<OverrideReason | "">("");
  const [durIdx, setDurIdx] = useState(0);
  const isUsd = alert.eventType.includes("daily_loss");
  const unit = isUsd ? " USD" : "%";
  const escalation = alert.observedValue !== null
    ? `${(alert.observedValue * 1.15).toFixed(2)}${unit}`
    : `115% of current value`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#13141f] p-6 shadow-2xl">
        <p className="text-base font-semibold text-strong">Override — I&apos;m holding</p>
        <p className="mt-1 text-sm text-muted">Suppresses re-alerts. Re-alerts if the violation worsens significantly or override expires.</p>

        <div className="mt-4 rounded-xl border border-white/8 bg-white/3 px-4 py-3">
          <p className="text-sm font-semibold text-strong">{alert.title}</p>
          <p className="mt-0.5 text-xs text-muted">{fmtValue(alert.observedValue, alert.eventType)} vs {fmtValue(alert.thresholdValue, alert.eventType)} limit</p>
        </div>

        <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-muted">Reason (optional)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {OVERRIDE_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r === reason ? "" : r)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${reason === r ? "bg-purple-600/70 text-white" : "border border-white/10 bg-white/5 text-muted hover:text-strong"}`}>
              {r}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-muted">Duration</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {OVERRIDE_DURATION_OPTIONS.map((opt, i) => (
            <button key={opt.label} type="button" onClick={() => setDurIdx(i)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${durIdx === i ? "bg-purple-600/70 text-white" : "border border-white/10 bg-white/5 text-muted hover:text-strong"}`}>
              {opt.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted">⚠ Re-alerts if observed exceeds <strong className="text-strong">{escalation}</strong></p>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-muted hover:text-strong">Cancel</button>
          <button type="button" disabled={isSaving}
            onClick={() => onConfirm({ reason: reason || undefined, expiresInHours: OVERRIDE_DURATION_OPTIONS[durIdx].hours })}
            className="rounded-xl bg-purple-600/80 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-600 disabled:opacity-50">
            {isSaving ? "Saving…" : "Confirm override"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Snooze menu ──────────────────────────────────────────────────────────────

function SnoozeMenu({ alertId, onSnooze, disabled }: { alertId: string; onSnooze: (id: string, m: number) => Promise<boolean>; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 text-[11px] text-white/35 transition-colors hover:text-white/75 disabled:opacity-30">
        Snooze
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-32 overflow-hidden rounded-xl border border-white/8 bg-[#0f1018] shadow-2xl">
          {SNOOZE_OPTIONS.map((opt) => (
            <button key={opt.minutes} type="button"
              onClick={() => { void onSnooze(alertId, opt.minutes); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-[11px] text-white/40 transition-colors hover:bg-white/4 hover:text-white/80">
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Rule tag ─────────────────────────────────────────────────────────────────

function ruleTag(eventType: string): string {
  if (eventType.includes("position")) return "Position";
  if (eventType.includes("drawdown"))  return "Drawdown";
  if (eventType.includes("daily_loss")) return "Daily loss";
  return "Rule";
}

function chipStyles(status: string, severity: string): string {
  if (status === "resolved")   return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  if (status === "snoozed")    return "border-sky-400/35 bg-sky-400/12 text-sky-300";
  if (status === "overridden") return "border-purple-400/35 bg-purple-400/12 text-purple-300";
  if (severity === "critical") return "border-red-500/50 bg-red-500/20 text-red-300";
  return "border-amber-400/40 bg-amber-400/15 text-amber-300";
}

function chipLabel(status: string, severity: string): string {
  if (status === "resolved")   return "Resolved";
  if (status === "snoozed")    return "Snoozed";
  if (status === "overridden") return "Overridden";
  if (severity === "critical") return "Critical";
  return "Warning";
}

function formatAlertSymbol(alert: RiskAlertRecord): string | null {
  const rawSymbol = alert.symbol?.trim();
  if (rawSymbol) {
    return rawSymbol.replace(/USDT$/i, "");
  }

  const match = alert.message.match(/^([A-Z0-9_-]+)\s+allocation is/i);
  if (match?.[1]) {
    return match[1];
  }

  const signatureMatch = alert.signature.match(/^position:([^:]+):/i);
  if (signatureMatch?.[1]) {
    return signatureMatch[1].replace(/USDT$/i, "");
  }

  return null;
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getAlertPriority(alert: RiskAlertRecord): number {
  if (alert.status === "active" && alert.severity === "critical") return 0;
  if (alert.status === "active") return 1;
  if (alert.status === "snoozed") return 2;
  if (alert.status === "overridden") return 3;
  if (alert.status === "resolved") return 4;
  return 5;
}

function compareAlerts(left: RiskAlertRecord, right: RiskAlertRecord): number {
  const priorityDiff = getAlertPriority(left) - getAlertPriority(right);
  if (priorityDiff !== 0) return priorityDiff;

  const timeDiff = toTimestamp(right.lastTriggeredAt) - toTimestamp(left.lastTriggeredAt);
  if (timeDiff !== 0) return timeDiff;

  return right.triggerCount - left.triggerCount;
}

// ─── Alert row ────────────────────────────────────────────────────────────────

type AlertRowProps = {
  alert: RiskAlertRecord;
  isUpdating: boolean;
  onAcknowledge: (id: string) => Promise<boolean>;
  onResolve: (id: string) => Promise<boolean>;
  onSnooze: (id: string, m: number) => Promise<boolean>;
  onCancelSnooze: (id: string) => Promise<boolean>;
  onOverrideClick: (alert: RiskAlertRecord) => void;
  onRevokeOverride: (id: string) => Promise<boolean>;
};

function AlertRow({ alert, isUpdating, onAcknowledge, onResolve, onSnooze, onCancelSnooze, onOverrideClick, onRevokeOverride }: AlertRowProps) {
  const isCrit = alert.severity === "critical";
  const isActive = alert.status === "active";
  const isSnoozed = alert.status === "snoozed";
  const isOverridden = alert.status === "overridden";
  const isResolved = alert.status === "resolved";

  const dotColor =
    isResolved   ? "bg-emerald-500/60" :
    isSnoozed    ? "bg-blue-400/60"    :
    isOverridden ? "bg-purple-400/60"  :
    isCrit       ? "bg-red-500"        : "bg-amber-400";

  const rowBg =
    isActive && isCrit ? "bg-red-500/6 border-red-500/30" :
    isOverridden       ? "bg-purple-500/5 border-purple-500/20" :
    isSnoozed          ? "bg-blue-400/5 border-blue-400/20" :
    isResolved         ? "bg-white/1 border-white/8" :
                         "border-white/6";

  const accentBar =
    isActive && isCrit ? "bg-red-500" :
    isOverridden       ? "bg-purple-400" :
    isSnoozed          ? "bg-sky-400" :
    isResolved         ? "bg-emerald-500/60" :
                         "bg-amber-400";
  const alertSymbol = formatAlertSymbol(alert);

  return (
    <div className={`relative flex items-center gap-3 rounded-xl border px-4 pt-5 pb-3.5 transition-colors hover:bg-white/2 ${rowBg}`}>
      {/* left accent stripe */}
      <span className={`absolute left-0 top-0 h-full w-0.75 rounded-l-xl ${accentBar}`} />

      <span className={`absolute left-3.5 top-0 -translate-y-1/2 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${chipStyles(alert.status, alert.severity)}`}>
        {isActive && isCrit && (
          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-400 align-middle" />
        )}
        {chipLabel(alert.status, alert.severity)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-semibold text-strong">
            {alert.title}
            {alertSymbol ? `: ${alertSymbol}` : ""}
          </p>
        </div>

        <p className="mt-0.5 text-xs text-muted">
          {fmtValue(alert.observedValue, alert.eventType)}
          <span className="mx-1 opacity-40">/</span>
          {fmtValue(alert.thresholdValue, alert.eventType)} limit
          <span className="mx-1.5 opacity-30">·</span>
          {formatRelativeTime(alert.firstTriggeredAt ?? alert.lastTriggeredAt)}
          {isSnoozed && alert.snoozedUntil && (
            <span className="ml-2 text-blue-300">re-alerts {formatRelativeTime(alert.snoozedUntil)}</span>
          )}
          {isOverridden && alert.overrideReason && (
            <span className="ml-2 text-purple-300">{alert.overrideReason}</span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2.5 pl-2 min-w-[200px]">
        {isActive && (
          <div className="flex items-center gap-2">
            <SnoozeMenu alertId={alert.id} onSnooze={onSnooze} disabled={isUpdating} />
            <span className="text-white/20">·</span>
            <button type="button" disabled={isUpdating} onClick={() => onOverrideClick(alert)}
              className="text-[11px] text-white/35 transition-colors hover:text-white/75 disabled:opacity-30">
              Override
            </button>
            <span className="text-white/20">·</span>
            <button type="button" disabled={isUpdating} onClick={() => void onResolve(alert.id)}
              className="text-[11px] text-white/35 transition-colors hover:text-white/75 disabled:opacity-30">
              Resolve
            </button>
          </div>
        )}
        {isSnoozed && (
          <button type="button" disabled={isUpdating} onClick={() => void onCancelSnooze(alert.id)}
            className="text-[11px] text-white/35 transition-colors hover:text-white/75 disabled:opacity-30">
            Wake up
          </button>
        )}
        {isOverridden && (
          <button type="button" disabled={isUpdating} onClick={() => void onRevokeOverride(alert.id)}
            className="text-[11px] text-white/35 transition-colors hover:text-white/75 disabled:opacity-30">
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  alerts: RiskAlertRecord[];
  isLoading: boolean;
  isUpdatingId: string | null;
  error: string | null;
  onAcknowledge: (id: string) => Promise<boolean>;
  onResolve: (id: string) => Promise<boolean>;
  onOverride: (id: string, payload: OverridePayload) => Promise<boolean>;
  onRevokeOverride: (id: string) => Promise<boolean>;
  onSnooze: (id: string, minutes: number) => Promise<boolean>;
  onCancelSnooze: (id: string) => Promise<boolean>;
};

export function RiskMonitorAlerts({
  alerts, isLoading, isUpdatingId, error,
  onAcknowledge, onResolve, onOverride, onRevokeOverride, onSnooze, onCancelSnooze,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<RiskAlertStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [overrideTarget, setOverrideTarget] = useState<RiskAlertRecord | null>(null);

  const summary = useMemo(() => ({
    critical:  alerts.filter((a) => a.status === "active" && a.severity === "critical").length,
    warning:   alerts.filter((a) => a.status === "active" && a.severity !== "critical").length,
    snoozed:   alerts.filter((a) => a.status === "snoozed").length,
    resolved:  alerts.filter((a) => a.status === "resolved").length,
  }), [alerts]);

  const filtered = useMemo(() => {
    const nextAlerts =
      statusFilter === "all" ? [...alerts] : alerts.filter((a) => a.status === statusFilter);
    nextAlerts.sort(compareAlerts);
    return nextAlerts;
  }, [alerts, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageAlerts = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleFilterChange = (f: RiskAlertStatus | "all") => { setStatusFilter(f); setPage(1); };

  const handleOverrideConfirm = async (payload: OverridePayload) => {
    if (!overrideTarget) return;
    const ok = await onOverride(overrideTarget.id, payload);
    if (ok) setOverrideTarget(null);
  };

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Critical", val: summary.critical, color: "text-red-400", bg: "bg-red-500/8 border-red-500/15" },
          { label: "Warning",  val: summary.warning,  color: "text-amber-400", bg: "bg-amber-400/8 border-amber-400/15" },
          { label: "Snoozed",  val: summary.snoozed,  color: "text-blue-400", bg: "bg-blue-400/8 border-blue-400/15" },
          { label: "Resolved today", val: summary.resolved, color: "text-emerald-400", bg: "bg-emerald-500/8 border-emerald-500/15" },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className={`rounded-xl border px-4 py-3 ${bg}`}>
            <p className={`text-2xl font-semibold tabular-nums ${color}`}>{val}</p>
            <p className="mt-0.5 text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter + count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button key={f.value} type="button" onClick={() => handleFilterChange(f.value)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                statusFilter === f.value
                  ? "border-white/20 bg-white/10 text-strong"
                  : "border-white/8 bg-transparent text-muted hover:border-white/15 hover:text-strong"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{filtered.length} alert{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div className="space-y-2">
          {[0,1,2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />)}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-xs text-red-300">{error}</div>
      ) : pageAlerts.length === 0 ? (
        <div className="rounded-xl border border-white/8 py-12 text-center">
          <p className="text-sm font-semibold text-strong">No alerts</p>
          <p className="mt-1 text-xs text-muted">
            {statusFilter === "all" ? "Everything is within limits." : `No ${statusFilter} alerts right now.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pageAlerts.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              isUpdating={isUpdatingId === alert.id}
              onAcknowledge={onAcknowledge}
              onResolve={onResolve}
              onSnooze={onSnooze}
              onCancelSnooze={onCancelSnooze}
              onOverrideClick={setOverrideTarget}
              onRevokeOverride={onRevokeOverride}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} type="button" onClick={() => setPage(p)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
                  p === currentPage
                    ? "border-white/20 bg-white/10 text-strong"
                    : "border-white/8 bg-transparent text-muted hover:border-white/15 hover:text-strong"
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Override modal */}
      {overrideTarget && (
        <OverrideModal
          alert={overrideTarget}
          isSaving={isUpdatingId === overrideTarget.id}
          onConfirm={(p) => void handleOverrideConfirm(p)}
          onClose={() => setOverrideTarget(null)}
        />
      )}
    </div>
  );
}
