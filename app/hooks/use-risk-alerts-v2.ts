"use client";

import { useCallback, useEffect, useState } from "react";
import type { RiskAlertRecord, RiskAlertStatus } from "@/app/lib/risk-types";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

type AlertsResponse = { alerts: RiskAlertRecord[] };

export type OverridePayload = {
  reason?: string;
  expiresInHours: number | null; // null = manual revoke only
};

type UseRiskAlertsV2Result = {
  alerts: RiskAlertRecord[];
  isLoading: boolean;
  isUpdatingId: string | null;
  error: string | null;
  reload: () => void;
  acknowledge: (id: string) => Promise<boolean>;
  resolve: (id: string) => Promise<boolean>;
  override: (id: string, payload: OverridePayload) => Promise<boolean>; // E1-S1
  revokeOverride: (id: string) => Promise<boolean>;                      // E1-S4
  snooze: (id: string, minutes: number) => Promise<boolean>;             // E2-S1
  cancelSnooze: (id: string) => Promise<boolean>;                        // E2-S1
};

const DEFAULT_INTERVAL_MS = 15_000;

export function useRiskAlertsV2(
  portfolioName: string,
  status: RiskAlertStatus | "all" = "all",
  refreshIntervalMs = DEFAULT_INTERVAL_MS,
  enabled = true
): UseRiskAlertsV2Result {
  const [alerts, setAlerts] = useState<RiskAlertRecord[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isUpdatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    let disposed = false;
    const ac = new AbortController();

    const load = async (background = false) => {
      if (!background) setLoading(true);
      setError(null);
      try {
        const res = await fetchWithSupabaseAuth(
          `/api/risk-rules/alerts?portfolioName=${encodeURIComponent(portfolioName)}&status=${encodeURIComponent(status)}&limit=40`,
          { cache: "no-store", signal: ac.signal }
        );
        if (!res.ok) throw new Error(`Failed to load alerts (${res.status})`);
        const payload = (await res.json()) as AlertsResponse;
        if (!disposed) setAlerts(payload.alerts ?? []);
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Unable to load alerts");
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void load();
    const intervalId = window.setInterval(() => void load(true), refreshIntervalMs);

    return () => {
      disposed = true;
      ac.abort();
      window.clearInterval(intervalId);
    };
  }, [enabled, portfolioName, status, refreshIntervalMs, refreshNonce]);

  const reload = useCallback(() => setRefreshNonce((n) => n + 1), []);

  const mutateStatus = useCallback(
    async (alertId: string, nextStatus: RiskAlertStatus, extra?: Record<string, unknown>): Promise<boolean> => {
      setUpdatingId(alertId);
      setError(null);
      try {
        const res = await fetchWithSupabaseAuth(
          `/api/risk-rules/alerts/${encodeURIComponent(alertId)}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: nextStatus, ...extra }),
          }
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Failed to update alert (${res.status})`);
        }
        const payload = (await res.json()) as { alert?: RiskAlertRecord };
        const updated = payload.alert;
        if (updated) {
          setAlerts((prev) =>
            status === "all"
              ? prev.map((a) => (a.id === updated.id ? updated : a))
              : prev.filter((a) => a.id !== updated.id)
          );
        }
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to update alert");
        return false;
      } finally {
        setUpdatingId(null);
      }
    },
    [status]
  );

  // E1-S4: revoke override via DELETE
  const revokeOverride = useCallback(
    async (alertId: string): Promise<boolean> => {
      setUpdatingId(alertId);
      setError(null);
      try {
        const res = await fetchWithSupabaseAuth(
          `/api/risk-rules/alerts/${encodeURIComponent(alertId)}/override`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Failed to revoke override (${res.status})`);
        }
        const payload = (await res.json()) as { alert?: RiskAlertRecord };
        const updated = payload.alert;
        if (updated) {
          setAlerts((prev) =>
            status === "all"
              ? prev.map((a) => (a.id === updated.id ? updated : a))
              : prev.filter((a) => a.id !== updated.id)
          );
        }
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to revoke override");
        return false;
      } finally {
        setUpdatingId(null);
      }
    },
    [status]
  );

  const cancelSnooze = useCallback(
    async (alertId: string): Promise<boolean> => {
      setUpdatingId(alertId);
      setError(null);
      try {
        const res = await fetchWithSupabaseAuth(
          `/api/risk-rules/alerts/${encodeURIComponent(alertId)}/snooze`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Failed to cancel snooze (${res.status})`);
        }
        const payload = (await res.json()) as { alert?: RiskAlertRecord };
        const updated = payload.alert;
        if (updated) {
          setAlerts((prev) =>
            status === "all"
              ? prev.map((a) => (a.id === updated.id ? updated : a))
              : prev.filter((a) => a.id !== updated.id)
          );
        }
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to cancel snooze");
        return false;
      } finally {
        setUpdatingId(null);
      }
    },
    [status]
  );

  return {
    alerts,
    isLoading,
    isUpdatingId,
    error,
    reload,
    acknowledge: useCallback((id: string) => mutateStatus(id, "acknowledged"), [mutateStatus]),
    resolve: useCallback((id: string) => mutateStatus(id, "resolved"), [mutateStatus]),
    override: useCallback(
      (id: string, { reason, expiresInHours }: OverridePayload) =>
        mutateStatus(id, "overridden", {
          overrideReason: reason,
          overrideExpiresInHours: expiresInHours,
        }),
      [mutateStatus]
    ),
    revokeOverride,
    snooze: useCallback(
      (id: string, minutes: number) =>
        mutateStatus(id, "snoozed", { snoozedUntilMinutes: minutes }),
      [mutateStatus]
    ),
    cancelSnooze,
  };
}
