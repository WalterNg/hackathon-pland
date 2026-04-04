"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

const MAIN_PORTFOLIO_NAME = "Main Portfolio";
const PORTFOLIOS_REFRESH_INTERVAL_MS = 15_000;

type PortfolioResponseRow = {
  id: string;
  name: string;
  isDefault: boolean;
  mode: "manual" | "binance_connected";
  createdAt: string;
  totalValueBtc: number | null;
  totalValueUsd: number;
};

export type BinanceImportAsset = {
  asset: string;
  quantity: number;
  price_usd: number;
};

export type PortfolioItem = {
  id: string;
  name: string;
  isDefault: boolean;
  mode: "manual" | "binance_connected";
  totalValueBtc: number | null;
  totalValueUsd: number;
};

type UsePortfoliosResult = {
  portfolios: PortfolioItem[];
  isLoading: boolean;
  error: string | null;
  createPortfolio: (
    name: string,
    mode: "manual" | "binance_connected",
    options?: { idempotencyKey?: string; assets?: BinanceImportAsset[] }
  ) => Promise<{ ok: boolean; message?: string; portfolioName?: string }>;
  syncPortfolio: (
    name: string,
    assets: BinanceImportAsset[]
  ) => Promise<{ ok: boolean; message?: string; adjustmentCount?: number }>;
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
        mode: item.mode,
        totalValueBtc: item.totalValueBtc,
        totalValueUsd: item.totalValueUsd
      }));

      if (nextPortfolios.length === 0) {
        setPortfolios([{ id: "main", name: MAIN_PORTFOLIO_NAME, isDefault: true, mode: "manual", totalValueBtc: null, totalValueUsd: 0 }]);
      } else {
        setPortfolios(nextPortfolios);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load portfolios");
      setPortfolios([{ id: "main", name: MAIN_PORTFOLIO_NAME, isDefault: true, mode: "manual", totalValueBtc: null, totalValueUsd: 0 }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolios();

    const intervalId = window.setInterval(() => {
      void loadPortfolios();
    }, PORTFOLIOS_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void loadPortfolios();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadPortfolios]);

  const createPortfolio = useCallback(async (
    name: string,
    mode: "manual" | "binance_connected",
    options?: { idempotencyKey?: string; assets?: BinanceImportAsset[] }
  ) => {
    const response = await fetchWithSupabaseAuth("/api/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mode, idempotencyKey: options?.idempotencyKey, assets: options?.assets })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, message: payload?.error ?? "Unable to create portfolio." };
    }

    const payload = (await response.json()) as { portfolio?: { name?: string } };

    await loadPortfolios();
    return { ok: true, portfolioName: payload.portfolio?.name };
  }, [loadPortfolios]);

  const syncPortfolio = useCallback(async (name: string, assets: BinanceImportAsset[]) => {
    const response = await fetchWithSupabaseAuth("/api/portfolios/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, assets })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, message: payload?.error ?? "Unable to sync portfolio." };
    }

    const payload = (await response.json()) as { adjustmentCount?: number };
    await loadPortfolios();
    return { ok: true, adjustmentCount: payload.adjustmentCount };
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
    syncPortfolio,
    removePortfolio,
    reload: loadPortfolios
  };
}
