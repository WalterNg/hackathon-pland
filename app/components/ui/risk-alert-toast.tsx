"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RiskAlertRecord } from "@/app/lib/risk-types";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

// ─── localStorage anti-spam helpers ──────────────────────────────────────────

const STORAGE_KEY = "risk_shown_alert_ids";
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000; // 24 h

type StoredEntry = { id: string; shownAt: number };

function loadShownIds(): Map<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as StoredEntry[];
    const now = Date.now();
    return new Map(
      entries
        .filter((e) => now - e.shownAt < PRUNE_AFTER_MS)
        .map((e) => [e.id, e.shownAt])
    );
  } catch {
    return new Map();
  }
}

function saveShownIds(map: Map<string, number>) {
  try {
    const entries: StoredEntry[] = Array.from(map.entries()).map(([id, shownAt]) => ({
      id,
      shownAt,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage unavailable — ignore
  }
}

function markShown(alertIds: string[]) {
  const map = loadShownIds();
  const now = Date.now();
  for (const id of alertIds) map.set(id, now);
  saveShownIds(map);
}

function filterNew(alerts: RiskAlertRecord[]): RiskAlertRecord[] {
  const shown = loadShownIds();
  return alerts.filter((a) => !shown.has(a.id));
}

// ─── Toast item ───────────────────────────────────────────────────────────────

type ToastItem = {
  id: string;
  alert: RiskAlertRecord;
  exiting: boolean;
};

function severityIcon(severity: string): string {
  if (severity === "critical") return "error";
  if (severity === "warning") return "warning";
  return "info";
}

function severityColors(severity: string) {
  if (severity === "critical")
    return { border: "border-danger/50", icon: "text-danger", bg: "bg-danger/10" };
  if (severity === "warning")
    return { border: "border-warning/50", icon: "text-warning", bg: "bg-warning/10" };
  return { border: "border-info/50", icon: "text-info", bg: "bg-info/10" };
}

type ToastCardProps = {
  item: ToastItem;
  portfolioName: string;
  onDismiss: (id: string) => void;
};

function ToastCard({ item, portfolioName, onDismiss }: ToastCardProps) {
  const { alert } = item;
  const colors = severityColors(alert.severity);

  return (
    <div
      className={`pointer-events-auto w-80 rounded-xl border ${colors.border} ${colors.bg} panel shadow-lg shadow-black/40 flex items-start gap-3 p-4 transition-all duration-300 ${
        item.exiting ? "opacity-0 translate-x-6" : "opacity-100 translate-x-0"
      }`}
    >
      <span className={`material-icons-outlined text-xl shrink-0 mt-0.5 ${colors.icon}`}>
        {severityIcon(alert.severity)}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-strong leading-tight">{alert.title}</p>
        <p className="text-xs text-muted mt-0.5 leading-snug line-clamp-2">{alert.message}</p>
        <a
          href={`/risk-rules?name=${encodeURIComponent(portfolioName)}`}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          View in Risk Rules
          <span className="material-icons-outlined text-sm">arrow_forward</span>
        </a>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 text-muted hover:text-strong transition-colors"
        aria-label="Dismiss"
      >
        <span className="material-icons-outlined text-base">close</span>
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;
const AUTO_DISMISS_MS = 8_000;

type Props = {
  portfolioName?: string;
};

export function RiskAlertToast({ portfolioName = "Main Portfolio" }: Props) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((toastId: string) => {
    // Animate out
    setToasts((prev) =>
      prev.map((t) => (t.id === toastId ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 300);

    const timer = timerRefs.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      timerRefs.current.delete(toastId);
    }
  }, []);

  const showAlerts = useCallback(
    (newAlerts: RiskAlertRecord[]) => {
      if (newAlerts.length === 0) return;
      markShown(newAlerts.map((a) => a.id));

      const items: ToastItem[] = newAlerts.slice(0, 3).map((alert) => ({
        id: `toast-${alert.id}`,
        alert,
        exiting: false,
      }));

      setToasts((prev) => [...prev, ...items]);

      for (const item of items) {
        const timer = setTimeout(() => dismiss(item.id), AUTO_DISMISS_MS);
        timerRefs.current.set(item.id, timer);
      }
    },
    [dismiss]
  );

  useEffect(() => {
    let disposed = false;

    const poll = async () => {
      try {
        const res = await fetchWithSupabaseAuth(
          `/api/risk-rules/alerts?portfolioName=${encodeURIComponent(portfolioName)}&status=active&limit=20`
        );
        if (!res.ok || disposed) return;
        const payload = (await res.json()) as { alerts: RiskAlertRecord[] };
        const newAlerts = filterNew(payload.alerts ?? []);
        if (!disposed) showAlerts(newAlerts);
      } catch {
        // silently ignore
      }
    };

    void poll();
    const intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      for (const timer of timerRefs.current.values()) clearTimeout(timer);
    };
  }, [portfolioName, showAlerts]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-label="Risk alerts"
    >
      {toasts.map((item) => (
        <ToastCard
          key={item.id}
          item={item}
          portfolioName={portfolioName}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}
