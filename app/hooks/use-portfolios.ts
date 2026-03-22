"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

const MAIN_PORTFOLIO_NAME = "Main Portfolio";

type PortfolioResponseRow = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  totalValueBtc: number | null;
};

export type PortfolioItem = {
  id: string;
  name: string;
  isDefault: boolean;
  totalValueBtc: number | null;
};

type UsePortfoliosResult = {
  portfolios: PortfolioItem[];
  isLoading: boolean;
  error: string | null;
  createPortfolio: (name: string) => Promise<{ ok: boolean; message?: string; portfolioName?: string }>;
  removePortfolio: (name: string) => Promise<{ ok: boolean; message?: string }>;
  reload: () => Promise<void>;
};

export function usePortfolios(): UsePortfoliosResult {
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPortfolios = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithSupabaseAuth("/api/portfolios", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load portfolios (${response.status})`);
      }

      const payload = (await response.json()) as { portfolios?: PortfolioResponseRow[] };
      const nextPortfolios = (payload.portfolios ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        isDefault: item.isDefault,
        totalValueBtc: item.totalValueBtc
      }));

      if (nextPortfolios.length === 0) {
        setPortfolios([{ id: "main", name: MAIN_PORTFOLIO_NAME, isDefault: true, totalValueBtc: null }]);
      } else {
        setPortfolios(nextPortfolios);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load portfolios");
      setPortfolios([{ id: "main", name: MAIN_PORTFOLIO_NAME, isDefault: true, totalValueBtc: null }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolios();
  }, [loadPortfolios]);

  const createPortfolio = useCallback(async (name: string) => {
    const response = await fetchWithSupabaseAuth("/api/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, message: payload?.error ?? "Unable to create portfolio." };
    }

    const payload = (await response.json()) as { portfolio?: { name?: string } };

    await loadPortfolios();
    return { ok: true, portfolioName: payload.portfolio?.name };
  }, [loadPortfolios]);

  const removePortfolio = useCallback(async (name: string) => {
    const response = await fetchWithSupabaseAuth("/api/portfolios", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, message: payload?.error ?? "Unable to remove portfolio." };
    }

    await loadPortfolios();
    return { ok: true };
  }, [loadPortfolios]);

  return {
    portfolios,
    isLoading,
    error,
    createPortfolio,
    removePortfolio,
    reload: loadPortfolios
  };
}
