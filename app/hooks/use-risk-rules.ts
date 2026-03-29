"use client";

import { useCallback, useEffect, useState } from "react";
import type { RiskProfile, RiskRulesFormValues, RiskRuleSource } from "@/app/lib/risk-types";

type RiskRulesResponse = {
  profile: RiskProfile | null;
  source: RiskRuleSource;
};

type UseRiskRulesResult = {
  profile: RiskProfile | null;
  source: RiskRuleSource;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  save: (values: RiskRulesFormValues) => Promise<boolean>;
  reload: () => Promise<void>;
};

export function useRiskRules(portfolioName: string): UseRiskRulesResult {
  const [profile, setProfile] = useState<RiskProfile | null>(null);
  const [source, setSource] = useState<RiskRuleSource>("none");
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let isDisposed = false;
    const abortController = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/risk/rules?portfolioName=${encodeURIComponent(portfolioName)}`, {
          cache: "no-store",
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load risk rules (${response.status})`);
        }

        const payload = (await response.json()) as RiskRulesResponse;
        if (isDisposed) {
          return;
        }

        setProfile(payload.profile ?? null);
        setSource(payload.source ?? "none");
      } catch (loadError) {
        if (!isDisposed) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load risk rules");
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
  }, [portfolioName, refreshNonce]);

  const reload = useCallback(async () => {
    setRefreshNonce((value) => value + 1);
  }, []);

  const save = useCallback(async (values: RiskRulesFormValues) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/risk/rules?portfolioName=${encodeURIComponent(portfolioName)}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Failed to save risk rules (${response.status})`);
      }

      const payload = (await response.json()) as RiskRulesResponse;
      setProfile(payload.profile ?? null);
      setSource(payload.source ?? "portfolio");
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save risk rules");
      return false;
    } finally {
      setSaving(false);
    }
  }, [portfolioName]);

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