"use client";

import { useCallback, useEffect, useState } from "react";
import type { RiskProfile, RiskRulesFormValues, RiskRuleSource } from "@/app/lib/risk-types";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

type GlobalRiskRulesResponse = {
  profile: RiskProfile | null;
  source: RiskRuleSource;
};

type UseGlobalRiskRulesResult = {
  profile: RiskProfile | null;
  source: RiskRuleSource;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  save: (values: RiskRulesFormValues) => Promise<boolean>;
  reload: () => Promise<void>;
};

export function useGlobalRiskRules(enabled = true): UseGlobalRiskRulesResult {
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
      setError(null);
      return;
    }

    let isDisposed = false;
    const abortController = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchWithSupabaseAuth("/api/risk/rules?scope=global", {
          cache: "no-store",
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load global risk rules (${response.status})`);
        }

        const payload = (await response.json()) as GlobalRiskRulesResponse;
        if (isDisposed) {
          return;
        }

        setProfile(payload.profile ?? null);
        setSource(payload.source ?? "none");
      } catch (loadError) {
        if (!isDisposed) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load global risk rules");
        }
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isDisposed = true;
      abortController.abort();
    };
  }, [enabled, refreshNonce]);

  const reload = useCallback(async () => {
    setRefreshNonce((value) => value + 1);
  }, []);

  const save = useCallback(async (values: RiskRulesFormValues) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetchWithSupabaseAuth("/api/risk/rules?scope=global", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Failed to save global risk rules (${response.status})`);
      }

      const payload = (await response.json()) as GlobalRiskRulesResponse;
      setProfile(payload.profile ?? null);
      setSource(payload.source ?? "global");
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save global risk rules");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    profile,
    source,
    isLoading,
    isSaving,
    error,
    save,
    reload,
  };
}