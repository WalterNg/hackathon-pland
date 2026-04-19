"use client";

import { useCallback, useEffect, useState } from "react";
import type { RiskEventRecord } from "@/app/lib/risk-types";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

type RiskScoreResponse = {
  events: RiskEventRecord[];
  riskScore: number;
};

type UseRiskScoreResult = {
  events: RiskEventRecord[];
  riskScore: number;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
};

const DEFAULT_INTERVAL_MS = 30_000;

export function useRiskScore(
  portfolioName: string,
  refreshIntervalMs = DEFAULT_INTERVAL_MS,
  enabled = true
): UseRiskScoreResult {
  const [events, setEvents] = useState<RiskEventRecord[]>([]);
  const [riskScore, setRiskScore] = useState(0);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setEvents([]);
      setRiskScore(0);
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
          `/api/risk-rules/score?portfolioName=${encodeURIComponent(portfolioName)}&limit=20`,
          { cache: "no-store", signal: ac.signal }
        );
        if (!res.ok) throw new Error(`Failed to load risk score (${res.status})`);
        const payload = (await res.json()) as RiskScoreResponse;
        if (!disposed) {
          setEvents(payload.events ?? []);
          setRiskScore(payload.riskScore ?? 0);
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Unable to load risk score");
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
  }, [enabled, portfolioName, refreshIntervalMs, refreshNonce]);

  const reload = useCallback(() => setRefreshNonce((n) => n + 1), []);

  return { events, riskScore, isLoading, error, reload };
}
