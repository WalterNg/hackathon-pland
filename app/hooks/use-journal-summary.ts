"use client";

import { useEffect, useState } from "react";
import type { JournalSummaryPayload } from "@/app/lib/journal-types";

type UseJournalSummaryResult = {
  summary: JournalSummaryPayload | null;
  isLoading: boolean;
  error: string | null;
};

export function useJournalSummary(days = 30): UseJournalSummaryResult {
  const [summary, setSummary] = useState<JournalSummaryPayload | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/journal/summary?days=${days}`, {
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Failed to load journal summary (${response.status})`);
        }

        const payload = (await response.json()) as JournalSummaryPayload;
        if (!isDisposed) {
          setSummary(payload);
        }
      } catch (loadError) {
        if (!isDisposed) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load journal summary");
          setSummary(null);
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
  }, [days]);

  return { summary, isLoading, error };
}
