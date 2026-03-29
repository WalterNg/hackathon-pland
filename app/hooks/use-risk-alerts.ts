"use client";

import { useCallback, useEffect, useState } from "react";
import type { RiskAlertRecord, RiskAlertStatus } from "@/app/lib/risk-types";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

type RiskAlertsResponse = {
  alerts: RiskAlertRecord[];
};

type UseRiskAlertsResult = {
  alerts: RiskAlertRecord[];
  isLoading: boolean;
  isUpdatingId: string | null;
  error: string | null;
  reload: () => Promise<void>;
  acknowledge: (alertId: string) => Promise<boolean>;
  resolve: (alertId: string) => Promise<boolean>;
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

  const mutateStatus = useCallback(async (alertId: string, nextStatus: RiskAlertStatus) => {
    setUpdatingId(alertId);
    setError(null);

    try {
      const response = await fetchWithSupabaseAuth(`/api/risk/alerts/${encodeURIComponent(alertId)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
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

  return {
    alerts,
    isLoading,
    isUpdatingId,
    error,
    reload,
    acknowledge: useCallback(async (alertId: string) => mutateStatus(alertId, "acknowledged"), [mutateStatus]),
    resolve: useCallback(async (alertId: string) => mutateStatus(alertId, "resolved"), [mutateStatus]),
  };
}