"use client";

import { useEffect, useState } from "react";

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
  portfolioUiSessionUserId: string | null;
  portfolioUiSession: PortfolioUiSessionRecord | null;
  isReady: boolean;
  resetPortfolioUiSession: () => void;
};

export function usePortfolioUiSession(portfolioId: string | null): UsePortfolioUiSessionResult {
  const [portfolioUiSession, setPortfolioUiSession] = useState<PortfolioUiSessionRecord | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const portfolioKey = normalizePortfolioUiSessionPortfolioKey(portfolioId);

  useEffect(() => {
    let isCancelled = false;
    setIsReady(false);
    setPortfolioUiSession(null);

    const exactRecord = portfolioKey ? readPortfolioUiSessionRecord(portfolioKey) : null;
    setCurrentUserId(exactRecord?.userId ?? null);
    if (exactRecord) {
      setPortfolioUiSession(exactRecord);
    }

    if (!portfolioKey) {
      setIsReady(true);
      return () => {
        isCancelled = true;
      };
    }

    const resolveSession = async () => {
      try {
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

        const currentRecord = readPortfolioUiSessionRecord(portfolioKey);
        if (currentRecord) {
          const nextRecord = writePortfolioUiSessionRecord({
            ...currentRecord,
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
      } finally {
        if (!isCancelled) {
          setIsReady(true);
        }
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
    portfolioUiSessionUserId: currentUserId,
    portfolioUiSession,
    isReady,
    resetPortfolioUiSession,
  };
}
