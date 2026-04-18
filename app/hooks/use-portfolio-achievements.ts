"use client";

import { useCallback, useEffect, useState } from "react";

import { backendBaseUrl } from "@/app/lib/backend-base-url";
import type { PortfolioAchievementsResponse, PortfolioAchievementUnlock } from "@/app/lib/achievement-types";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

async function fetchBackendWithSupabaseAuth(path: string, init: RequestInit = {}) {
  const supabase = await createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

type UsePortfolioAchievementsResult = {
  unlocks: PortfolioAchievementUnlock[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function usePortfolioAchievements(
  portfolioId: string | null,
  portfolioName: string
): UsePortfolioAchievementsResult {
  const [unlocks, setUnlocks] = useState<PortfolioAchievementUnlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      if (portfolioId?.trim()) {
        searchParams.set("portfolio_id", portfolioId.trim());
      } else {
        searchParams.set("portfolio_name", portfolioName);
      }

      const response = await fetchBackendWithSupabaseAuth(`/api/portfolio_achievements?${searchParams.toString()}`);
      const payload = (await response.json().catch(() => null)) as (PortfolioAchievementsResponse & { detail?: string }) | null;

      if (!response.ok) {
        throw new Error(payload?.detail || "Unable to load portfolio achievements.");
      }

      setUnlocks(payload?.unlocks ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load portfolio achievements.");
      setUnlocks([]);
    } finally {
      setIsLoading(false);
    }
  }, [portfolioId, portfolioName]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { unlocks, isLoading, error, reload };
}
