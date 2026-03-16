"use client";

import { useCallback, useEffect, useState } from "react";
import type { RiskEventRecord, RiskProfile } from "@/app/lib/risk-types";

type RiskEventsResponse = {
  profile: RiskProfile | null;
  events: RiskEventRecord[];
};

type UseRiskEventsResult = {
  profile: RiskProfile | null;
  events: RiskEventRecord[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const DEFAULT_REFRESH_INTERVAL_MS = 10_000;

export function useRiskEvents(
  portfolioName: string,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS
): UseRiskEventsResult {
  const [profile, setProfile] = useState<RiskProfile | null>(null);
  const [events, setEvents] = useState<RiskEventRecord[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let isDisposed = false;
    const abortController = new AbortController();

    const load = async (isBackgroundRefresh = false) => {
      if (!isBackgroundRefresh) {
        setLoading(true);
      }

      setError(null);

      try {
        const response = await fetch(
          `/api/risk/events?portfolioName=${encodeURIComponent(portfolioName)}&limit=6`,
          {
            cache: "no-store",
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load risk events (${response.status})`);
        }

        const payload = (await response.json()) as RiskEventsResponse;
        if (isDisposed) {
          return;
        }

        setProfile(payload.profile ?? null);
        setEvents(payload.events ?? []);
      } catch (loadError) {
        if (isDisposed) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load risk events");
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
  }, [portfolioName, refreshIntervalMs, refreshNonce]);

  const reload = useCallback(async () => {
    setRefreshNonce((value) => value + 1);
  }, []);

  return {
    profile,
    events,
    isLoading,
    error,
    reload,
  };
}
