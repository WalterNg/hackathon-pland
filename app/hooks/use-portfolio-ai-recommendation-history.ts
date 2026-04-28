"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  PortfolioAIRecommendationHistoryItem,
  PortfolioAIRecommendationHistoryPage,
} from "@/app/lib/portfolio-types";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

type UsePortfolioAIRecommendationHistoryOptions = {
  portfolioName: string;
  page: number;
  pageSize: number;
  portfolioResolved?: boolean;
};

type UsePortfolioAIRecommendationHistoryResult = {
  pageData: PortfolioAIRecommendationHistoryPage | null;
  items: PortfolioAIRecommendationHistoryItem[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
};

function normalizePortfolioName(value: string): string {
  return value.trim();
}

function buildHistoryRequestUrl(portfolioName: string, page: number, pageSize: number): string {
  const url = new URL("/api/ai/analyze-trading-agent/history", window.location.origin);
  url.searchParams.set("portfolioName", portfolioName);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  return url.toString();
}

export function usePortfolioAIRecommendationHistory({
  portfolioName,
  page,
  pageSize,
  portfolioResolved = true,
}: UsePortfolioAIRecommendationHistoryOptions): UsePortfolioAIRecommendationHistoryResult {
  const [pageData, setPageData] = useState<PortfolioAIRecommendationHistoryPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const normalizedPortfolioName = useMemo(() => normalizePortfolioName(portfolioName), [portfolioName]);

  useEffect(() => {
    let isCancelled = false;

    const loadHistory = async () => {
      if (!normalizedPortfolioName || !portfolioResolved) {
        setPageData(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      setPageData(null);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchWithSupabaseAuth(
          buildHistoryRequestUrl(normalizedPortfolioName, page, pageSize),
          {
            cache: "no-store",
          }
        );

        const payload = (await response.json().catch(() => null)) as PortfolioAIRecommendationHistoryPage & {
          error?: string;
        } | null;

        if (isCancelled) {
          return;
        }

        if (!response.ok || !payload) {
          setPageData(null);
          setError(payload?.error ?? "Unable to load AI recommendation history.");
          return;
        }

        setPageData(payload);
      } catch (requestError) {
        if (!isCancelled) {
          setPageData(null);
          setError(requestError instanceof Error ? requestError.message : "Unable to load AI recommendation history.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      isCancelled = true;
    };
  }, [normalizedPortfolioName, page, pageSize, portfolioResolved, refreshToken]);

  return {
    pageData,
    items: pageData?.items ?? [],
    isLoading,
    error,
    reload: () => setRefreshToken((value) => value + 1),
  };
}
