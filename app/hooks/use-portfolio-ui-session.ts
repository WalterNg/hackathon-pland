"use client";

import { useEffect, useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";
import {
  clearAllPortfolioUiSessionRecords,
  createPortfolioUiSessionRecord,
  deletePortfolioUiSessionRecord,
  normalizePortfolioUiSessionPortfolioKey,
  readPortfolioUiSessionRecord,
  type PortfolioUiSessionRecord,
  writePortfolioUiSessionRecord,
} from "@/app/lib/portfolio-ui-session";

type UsePortfolioUiSessionResult = {
  portfolioUiSessionId: string | null;
  portfolioUiSession: PortfolioUiSessionRecord | null;
  resetPortfolioUiSession: () => void;
};

export function usePortfolioUiSession(portfolioId: string | null): UsePortfolioUiSessionResult {
  const [portfolioUiSession, setPortfolioUiSession] = useState<PortfolioUiSessionRecord | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const portfolioKey = useMemo(
    () => normalizePortfolioUiSessionPortfolioKey(portfolioId),
    [portfolioId]
  );

  useEffect(() => {
    let isCancelled = false;

    if (!portfolioKey) {
      setPortfolioUiSession(null);
      return () => {
        isCancelled = true;
      };
    }

    const resolveSession = async () => {
      const supabase = await createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (isCancelled) {
        return;
      }

      const userId = session?.user.id ?? null;
      setCurrentUserId(userId);

      if (!userId) {
        return;
      }

      const exactRecord = readPortfolioUiSessionRecord(portfolioKey);
      if (exactRecord) {
        const nextRecord = writePortfolioUiSessionRecord({
          ...exactRecord,
          userId,
          lastSeenAt: new Date().toISOString(),
        });
        if (!isCancelled) {
          setPortfolioUiSession(nextRecord);
        }
        return;
      }

      const nextRecord = writePortfolioUiSessionRecord(
        createPortfolioUiSessionRecord(userId, portfolioKey)
      );
      if (!isCancelled) {
        setPortfolioUiSession(nextRecord);
      }
    };

    void resolveSession();

    return () => {
      isCancelled = true;
    };
  }, [portfolioKey]);

  const resetPortfolioUiSession = () => {
    if (!currentUserId || !portfolioKey) {
      clearAllPortfolioUiSessionRecords();
      setPortfolioUiSession(null);
      return;
    }

    deletePortfolioUiSessionRecord(portfolioKey);
    setPortfolioUiSession(null);
  };

  return {
    portfolioUiSessionId: portfolioUiSession?.sessionId ?? null,
    portfolioUiSession,
    resetPortfolioUiSession,
  };
}
