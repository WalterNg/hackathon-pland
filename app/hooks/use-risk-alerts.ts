"use client";

import { useCallback, useEffect, useState } from "react";
import type { RiskAlertRecord, RiskAlertStatus } from "@/app/lib/risk-types";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

type RiskAlertsResponse = {
  alerts: RiskAlertRecord[];
};

export type OverridePayload = {
  reason?: string;
  expiresInHours: number | null;
};

type UseRiskAlertsResult = {
  alerts: RiskAlertRecord[];
  isLoading: boolean;
  isUpdatingId: string | null;
  error: string | null;
  reload: () => Promise<void>;
  acknowledge: (alertId: string) => Promise<boolean>;
  resolve: (alertId: string) => Promise<boolean>;
  override: (alertId: string, payload: OverridePayload) => Promise<boolean>;
  revokeOverride: (alertId: string) => Promise<boolean>;
  snooze: (alertId: string, minutes: number) => Promise<boolean>;
  cancelSnooze: (alertId: string) => Promise<boolean>;
};

const DEFAULT_REFRESH_INTERVAL_MS = 15_000;

export function useRiskAlerts(
  portfolioName: string,
  status: RiskAlertStatus | "all",
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
  enabled = true
): UseRiskAlertsResult {
  const [alerts, setAlerts] = useState<RiskAlertRecord[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isUpdatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let isDisposed = false;
    const abortController = new AbortController();

    const load = async (isBackgroundRefresh = false) => {
      if (!isBackgroundRefresh) {
        setLoading(true);
      }

      setError(null);

      try {
        const response = await fetchWithSupabaseAuth(
          `/api/risk/alerts?portfolioName=${encodeURIComponent(portfolioName)}&status=${encodeURIComponent(status)}&limit=40`,
          {
            cache: "no-store",
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load alerts (${response.status})`);
        }

        const payload = (await response.json()) as RiskAlertsResponse;
        if (!isDisposed) {
          setAlerts(payload.alerts ?? []);
        }
      } catch (loadError) {
        if (!isDisposed) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load alerts");
        }
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load(true);
    }, refreshIntervalMs);

    return () => {
      isDisposed = true;
      abortController.abort();
      window.clearInterval(intervalId);
    };
  }, [enabled, portfolioName, refreshIntervalMs, refreshNonce, status]);

  const reload = useCallback(async () => {
    setRefreshNonce((value) => value + 1);
  }, []);

  const mutateStatus = useCallback(async (alertId: string, nextStatus: RiskAlertStatus, extra?: Record<string, unknown>) => {
    setUpdatingId(alertId);
    setError(null);

    try {
      const response = await fetchWithSupabaseAuth(`/api/risk/alerts/${encodeURIComponent(alertId)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus, ...extra }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Failed to update alert (${response.status})`);
      }

      const payload = (await response.json()) as { alert?: RiskAlertRecord };
      const updatedAlert = payload.alert ?? null;
      if (updatedAlert) {
        setAlerts((currentAlerts) => {
          const nextAlerts = currentAlerts.map((alert) => (alert.id === updatedAlert.id ? updatedAlert : alert));
          return status === "all" ? nextAlerts : nextAlerts.filter((alert) => alert.status === status);
        });
      }

      return true;
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to update alert");
      return false;
    } finally {
      setUpdatingId(null);
    }
  }, [status]);

  const revokeOverride = useCallback(async (alertId: string): Promise<boolean> => {
    setUpdatingId(alertId);
    setError(null);
    try {
      const response = await fetchWithSupabaseAuth(
        `/api/risk/alerts/${encodeURIComponent(alertId)}/override`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Failed to revoke override (${response.status})`);
      }
      const payload = (await response.json()) as { alert?: RiskAlertRecord };
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
  }, [status]);

  const cancelSnooze = useCallback(async (alertId: string): Promise<boolean> => {
    setUpdatingId(alertId);
    setError(null);
    try {
      const response = await fetchWithSupabaseAuth(
        `/api/risk/alerts/${encodeURIComponent(alertId)}/snooze`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Failed to cancel snooze (${response.status})`);
      }
      const payload = (await response.json()) as { alert?: RiskAlertRecord };
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
  }, [status]);

  return {
    alerts,
    isLoading,
    isUpdatingId,
    error,
    reload,
    acknowledge: useCallback(async (alertId: string) => mutateStatus(alertId, "acknowledged"), [mutateStatus]),
    resolve: useCallback(async (alertId: string) => mutateStatus(alertId, "resolved"), [mutateStatus]),
    override: useCallback(
      async (alertId: string, { reason, expiresInHours }: OverridePayload) =>
        mutateStatus(alertId, "overridden", { overrideReason: reason, overrideExpiresInHours: expiresInHours }),
      [mutateStatus]
    ),
    revokeOverride,
    snooze: useCallback(
      async (alertId: string, minutes: number) =>
        mutateStatus(alertId, "snoozed", { snoozedUntilMinutes: minutes }),
      [mutateStatus]
    ),
    cancelSnooze,
  };
}
