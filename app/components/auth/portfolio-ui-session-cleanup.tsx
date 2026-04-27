"use client";

import { useEffect } from "react";
import { useRef } from "react";

import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";
import { clearAllPortfolioUiSessionRecords } from "@/app/lib/portfolio-ui-session";
import { clearAllPortfolioAIRecommendationCache } from "@/app/lib/ai-recommendation-cache";

export function PortfolioUiSessionCleanup() {
  const hasSeenAuthenticatedSessionRef = useRef(false);

  useEffect(() => {
    const supabaseInit = async () => {
      const supabase = await createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        hasSeenAuthenticatedSessionRef.current = true;
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (nextSession?.access_token) {
          hasSeenAuthenticatedSessionRef.current = true;
        }

        if (event === "SIGNED_OUT" && hasSeenAuthenticatedSessionRef.current) {
          clearAllPortfolioUiSessionRecords();
          clearAllPortfolioAIRecommendationCache();
          hasSeenAuthenticatedSessionRef.current = false;
        }
      });

      return subscription;
    };

    let unsubscribe: { unsubscribe: () => void } | null = null;
    void supabaseInit().then((subscription) => {
      unsubscribe = subscription;
    });

    return () => {
      unsubscribe?.unsubscribe();
    };
  }, []);

  return null;
}
