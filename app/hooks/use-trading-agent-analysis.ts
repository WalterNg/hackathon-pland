"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import type { PortfolioAIRecommendation } from "@/app/lib/portfolio-types";
import type {
  TradingAgentPreparedContext,
  TradingAgentResult,
  TradingAgentTraceEvent,
} from "@/app/lib/trading-agent-types";
import {
  buildTradingAgentRuntimeKey,
  getTradingAgentAnalysisSnapshot,
  isTradingAgentAnalysisStreaming,
  primeTradingAgentAnalysis,
  startTradingAgentAnalysis,
  subscribeTradingAgentAnalysis,
  type TradingAgentAnalysisSnapshot,
  type TradingAgentRunStatus,
} from "@/app/lib/trading-agent-analysis-runtime";
import { buildTradingAgentResultFromRecommendation } from "@/app/lib/trading-agent-rehydration";
import {
  readPortfolioAIRecommendationCache,
  writePortfolioAIRecommendationCache,
} from "@/app/lib/ai-recommendation-cache";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

type AnalyzeInput = {
  portfolioName: string;
};

type UseTradingAgentAnalysisResult = {
  recommendation: PortfolioAIRecommendation | null;
  latestResult: TradingAgentResult | null;
  preparedContext: TradingAgentPreparedContext | null;
  trace: TradingAgentTraceEvent[];
  warnings: string[];
  isAnalyzing: boolean;
  status: TradingAgentRunStatus;
  error: string | null;
  activeNodes: string[];
  progressLabel: string;
  completedSteps: number;
  totalSteps: number;
  analyze: (input: AnalyzeInput) => Promise<void>;
};

const TOTAL_STEPS = 10;
const RECOMMENDATION_LOAD_COOLDOWN_MS = 1_500;
const latestRecommendationRequestAt = new Map<string, number>();

type UseTradingAgentAnalysisOptions = {
  scopeKey?: string | null;
  portfolioId?: string | null;
  portfolioUiSessionId?: string | null;
  portfolioUiSessionUserId?: string | null;
  portfolioUiSessionReady?: boolean;
  portfolioResolved?: boolean;
  portfolioRecommendationRefreshToken?: number;
};

type RecommendationCacheParts = {
  userId: string;
  portfolioId: string;
  portfolioUiSessionId: string;
};

function normalizeReadableValue(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function getRecommendationCacheParts(
  portfolioId: string | null | undefined,
  portfolioUiSessionId: string | null | undefined,
  portfolioUiSessionUserId: string | null | undefined
): RecommendationCacheParts | null {
  const userId = normalizeReadableValue(portfolioUiSessionUserId);
  const nextPortfolioId = normalizeReadableValue(portfolioId);
  const sessionId = normalizeReadableValue(portfolioUiSessionId);

  if (!userId || !nextPortfolioId || !sessionId) {
    return null;
  }

  return {
    userId,
    portfolioId: nextPortfolioId,
    portfolioUiSessionId: sessionId,
  };
}

function buildRecommendationRequestKey(
  scopeKey: string | null | undefined,
  portfolioId: string | null | undefined,
  portfolioUiSessionId: string | null | undefined,
  refreshToken: number
): string {
  return `${scopeKey ?? ""}::${portfolioId ?? ""}::${portfolioUiSessionId ?? ""}::${refreshToken}`;
}

function humanizeNodeLabel(node: string): string {
  return node
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function useTradingAgentAnalysis({
  scopeKey,
  portfolioId,
  portfolioUiSessionId,
  portfolioUiSessionUserId,
  portfolioUiSessionReady = true,
  portfolioResolved = true,
  portfolioRecommendationRefreshToken = 0,
}: UseTradingAgentAnalysisOptions): UseTradingAgentAnalysisResult {
  const runtimeKey = useMemo(
    () => buildTradingAgentRuntimeKey(scopeKey, portfolioId, portfolioUiSessionId),
    [scopeKey, portfolioId, portfolioUiSessionId]
  );
  const [snapshot, setSnapshot] = useState<TradingAgentAnalysisSnapshot>(() =>
    getTradingAgentAnalysisSnapshot(runtimeKey)
  );
  const recommendationCacheParts = getRecommendationCacheParts(
    portfolioId,
    portfolioUiSessionId,
    portfolioUiSessionUserId
  );

  const persistRecommendationToCache = (nextRecommendation: PortfolioAIRecommendation | null) => {
    if (!nextRecommendation || !recommendationCacheParts) {
      return;
    }

    writePortfolioAIRecommendationCache(recommendationCacheParts, nextRecommendation);
  };

  useEffect(() => {
    if (!runtimeKey) {
      setSnapshot(getTradingAgentAnalysisSnapshot(null));
      return;
    }

    setSnapshot(getTradingAgentAnalysisSnapshot(runtimeKey));
    return subscribeTradingAgentAnalysis(runtimeKey, setSnapshot);
  }, [runtimeKey]);

  useLayoutEffect(() => {
    if (!scopeKey?.trim() || !portfolioResolved || !recommendationCacheParts) {
      return;
    }

    const cachedRecommendation = readPortfolioAIRecommendationCache(recommendationCacheParts);
    if (!runtimeKey || !cachedRecommendation) {
      return;
    }

    primeTradingAgentAnalysis(
      runtimeKey,
      cachedRecommendation.recommendation,
      cachedRecommendation.recommendation.analysisResult ??
        buildTradingAgentResultFromRecommendation(cachedRecommendation.recommendation),
      cachedRecommendation.recommendation.preparedContext ?? null
    );
  }, [
    runtimeKey,
    portfolioId,
    portfolioResolved,
    portfolioUiSessionId,
    portfolioUiSessionUserId,
    portfolioRecommendationRefreshToken,
    scopeKey,
  ]);

  useEffect(() => {
    let isCancelled = false;

    const loadLatestRecommendation = async () => {
      if (!runtimeKey || !scopeKey?.trim() || !portfolioResolved || !portfolioUiSessionReady) {
        return;
      }

      try {
        const requestKey = buildRecommendationRequestKey(
          scopeKey,
          portfolioId,
          portfolioUiSessionId,
          portfolioRecommendationRefreshToken
        );
        const lastRequestedAt = latestRecommendationRequestAt.get(requestKey) ?? 0;
        const now = Date.now();
        if (now - lastRequestedAt < RECOMMENDATION_LOAD_COOLDOWN_MS) {
          return;
        }
        latestRecommendationRequestAt.set(requestKey, now);

        const url = new URL("/api/ai/analyze-trading-agent", window.location.origin);
        url.searchParams.set("portfolioName", scopeKey);
        if (portfolioUiSessionId) {
          url.searchParams.set("portfolioUiSessionId", portfolioUiSessionId);
        }

        const response = await fetchWithSupabaseAuth(url.toString(), {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { recommendation?: PortfolioAIRecommendation | null }
          | null;

        if (isCancelled || !response.ok || isTradingAgentAnalysisStreaming(runtimeKey)) {
          return;
        }

        const nextRecommendation = payload?.recommendation ?? null;
        primeTradingAgentAnalysis(
          runtimeKey,
          nextRecommendation,
          nextRecommendation
            ? nextRecommendation.analysisResult ?? buildTradingAgentResultFromRecommendation(nextRecommendation)
            : null,
          nextRecommendation?.preparedContext ?? null
        );

        persistRecommendationToCache(nextRecommendation);
      } catch {
        return;
      }
    };

    void loadLatestRecommendation();

    return () => {
      isCancelled = true;
    };
  }, [
    runtimeKey,
    portfolioId,
    portfolioResolved,
    portfolioUiSessionId,
    portfolioUiSessionUserId,
    portfolioUiSessionReady,
    portfolioRecommendationRefreshToken,
    scopeKey,
  ]);

  const analyze = async ({ portfolioName }: AnalyzeInput) => {
    if (!runtimeKey || !portfolioName.trim() || snapshot.status === "streaming") {
      return;
    }

    await startTradingAgentAnalysis(runtimeKey, {
      portfolioName,
      portfolioUiSessionId,
      onRecommendationPersist: persistRecommendationToCache,
    });
  };

  const progressLabel = useMemo(() => {
    if (snapshot.status === "streaming" && snapshot.activeNodes.length > 0) {
      return `${humanizeNodeLabel(snapshot.activeNodes[0])} in progress`;
    }

    if (snapshot.status === "completed" && snapshot.recommendation) {
      return "Analysis complete";
    }

    if (snapshot.status === "error") {
      return "Stream interrupted";
    }

    return "Ready to analyze";
  }, [snapshot.activeNodes, snapshot.recommendation, snapshot.status]);

  return {
    recommendation: snapshot.recommendation,
    latestResult: snapshot.latestResult,
    preparedContext: snapshot.preparedContext,
    trace: snapshot.trace,
    warnings: snapshot.warnings,
    isAnalyzing: snapshot.status === "streaming",
    status: snapshot.status,
    error: snapshot.error,
    activeNodes: snapshot.activeNodes,
    progressLabel,
    completedSteps: snapshot.trace.filter((item) => item.status === "completed").length,
    totalSteps: TOTAL_STEPS,
    analyze,
  };
}
