"use client";

import { useCallback, useEffect, useState } from "react";
import type { RiskProfile, RiskRuleSource } from "@/app/lib/risk-types";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

type RiskRulesResponse = {
  profile: RiskProfile | null;
  source: RiskRuleSource;
};

export type RiskRulesFormValues = {
  maxDrawdownPct: number | null;
  maxPositionSizePct: number | null;
  maxDailyLossUsd: number | null;
};

type UseRiskRulesV2Result = {
  profile: RiskProfile | null;
  source: RiskRuleSource;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  save: (values: RiskRulesFormValues) => Promise<boolean>;
  reload: () => void;
};

export function useRiskRulesV2(
  portfolioName: string,
  enabled = true
): UseRiskRulesV2Result {
  const [profile, setProfile] = useState<RiskProfile | null>(null);
  const [source, setSource] = useState<RiskRuleSource>("none");
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setProfile(null);
      setSource("none");
      setLoading(false);
      return;
    }

    let disposed = false;
    const ac = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithSupabaseAuth(
          `/api/risk-rules/rules?portfolioName=${encodeURIComponent(portfolioName)}`,
          { cache: "no-store", signal: ac.signal }
        );
        if (!res.ok) throw new Error(`Failed to load rules (${res.status})`);
        const payload = (await res.json()) as RiskRulesResponse;
        if (!disposed) {
          setProfile(payload.profile ?? null);
          setSource(payload.source ?? "none");
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Unable to load rules");
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void load();
    return () => {
      disposed = true;
      ac.abort();
    };
  }, [enabled, portfolioName, refreshNonce]);

  const reload = useCallback(() => setRefreshNonce((n) => n + 1), []);

  const save = useCallback(
    async (values: RiskRulesFormValues): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetchWithSupabaseAuth(
          `/api/risk-rules/rules?portfolioName=${encodeURIComponent(portfolioName)}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(values),
          }
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Failed to save rules (${res.status})`);
        }
        const payload = (await res.json()) as RiskRulesResponse;
        setProfile(payload.profile ?? null);
        setSource(payload.source ?? "portfolio");
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save rules");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [portfolioName]
  );

  return { profile, source, isLoading, isSaving, error, save, reload };
}
