"use client";

import { useEffect, useState } from "react";
import type { DashboardRecentTransaction } from "@/app/lib/portfolio-types";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

type UseDashboardTransactionsResult = {
  transactions: DashboardRecentTransaction[];
  isLoading: boolean;
  error: string | null;
};

export function useDashboardTransactions(
  portfolioName: string,
  limit = 5
): UseDashboardTransactionsResult {
  const [transactions, setTransactions] = useState<DashboardRecentTransaction[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchWithSupabaseAuth(
          `/api/portfolio/transactions?portfolioName=${encodeURIComponent(portfolioName)}&limit=${limit}`,
          {
            cache: "no-store",
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load transactions (${response.status})`);
        }

        const payload = (await response.json()) as { transactions?: DashboardRecentTransaction[] };
        if (!isDisposed) {
          setTransactions(payload.transactions ?? []);
        }
      } catch (loadError) {
        if (!isDisposed) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load transactions");
          setTransactions([]);
        }
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [portfolioName, limit]);

  return { transactions, isLoading, error };
}
