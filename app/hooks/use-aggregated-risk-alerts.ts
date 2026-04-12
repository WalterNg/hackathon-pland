"use client";

import { useCallback, useEffect, useState } from "react";
import type { AggregatedRiskAlertSummary, RiskAlertGroup, RiskAlertStatus } from "@/app/lib/risk-types";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

type AggregatedRiskAlertsResponse = {
  summary: AggregatedRiskAlertSummary;
  groups: RiskAlertGroup[];
};

type UseAggregatedRiskAlertsResult = {
  summary: AggregatedRiskAlertSummary;
  groups: RiskAlertGroup[];
  isLoading: boolean;
  isUpdatingId: string | null;
  error: string | null;
  reload: () => Promise<void>;
  acknowledge: (alertId: string) => Promise<boolean>;
  resolve: (alertId: string) => Promise<boolean>;
};

const DEFAULT_REFRESH_INTERVAL_MS = 15_000;

const EMPTY_SUMMARY: AggregatedRiskAlertSummary = {
  criticalActiveAlerts: 0,
  otherActiveAlerts: 0,
  recentRiskEvents: 0,
  childPortfolioCount: 0,
  portfoliosWithAlerts: 0,
};

export function useAggregatedRiskAlerts(
  status: RiskAlertStatus | "all",
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
  enabled = true
): UseAggregatedRiskAlertsResult {
  const [summary, setSummary] = useState<AggregatedRiskAlertSummary>(EMPTY_SUMMARY);
  const [groups, setGroups] = useState<RiskAlertGroup[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isUpdatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setSummary(EMPTY_SUMMARY);
      setGroups([]);
      setLoading(false);
      setError(null);
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
          `/api/risk/alerts/aggregate?status=${encodeURIComponent(status)}`,
          {
            cache: "no-store",
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load aggregated alerts (${response.status})`);
        }

        const payload = (await response.json()) as AggregatedRiskAlertsResponse;
        if (isDisposed) {
          return;
        }

        setSummary(payload.summary ?? EMPTY_SUMMARY);
        setGroups(payload.groups ?? []);
      } catch (loadError) {
        if (isDisposed) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load aggregated alerts");
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

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void load(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isDisposed = true;
      abortController.abort();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, refreshIntervalMs, refreshNonce, status]);

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

      await reload();
      return true;
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to update alert");
      return false;
    } finally {
      setUpdatingId(null);
    }
  }, [reload]);

  return {
    summary,
    groups,
    isLoading,
    isUpdatingId,
    error,
    reload,
    acknowledge: useCallback(async (alertId: string) => mutateStatus(alertId, "acknowledged"), [mutateStatus]),
    resolve: useCallback(async (alertId: string) => mutateStatus(alertId, "resolved"), [mutateStatus]),
  };
}