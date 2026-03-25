"use client";

import { useEffect, useRef, useState } from "react";

import type { PortfolioSnapshot, PortfolioAIRecommendation } from "@/app/lib/portfolio-types";
import type { RiskEventRecord, RiskProfile } from "@/app/lib/risk-types";

export type AIAnalysisStepId =
  | "snapshot"
  | "ta"
  | "news"
  | "risk"
  | "synthesis";

export type AIAnalysisStep = {
  id: AIAnalysisStepId;
  label: string;
  description: string;
};

export type AIAnalysisStepStatus = "pending" | "active" | "completed";

type AnalyzeInput = {
  snapshot: PortfolioSnapshot | null;
  profile: RiskProfile | null;
  events: RiskEventRecord[];
  portfolioName: string;
};

type UsePortfolioAIAnalysisResult = {
  recommendation: PortfolioAIRecommendation | null;
  isAnalyzing: boolean;
  activeStepId: AIAnalysisStepId | null;
  error: string | null;
  analyze: (input: AnalyzeInput) => Promise<void>;
  steps: AIAnalysisStep[];
};

const STEP_DELAY_MS = 850;

const STEPS: AIAnalysisStep[] = [
  {
    id: "snapshot",
    label: "Preparing portfolio snapshot",
    description: "Collecting current holdings, performance, and live market values.",
  },
  {
    id: "ta",
    label: "Running technical analysis",
    description: "Evaluating breadth, trend strength, and momentum across the portfolio.",
  },
  {
    id: "news",
    label: "Reading market context",
    description: "Summarizing the broad narrative around the portfolio's exposure.",
  },
  {
    id: "risk",
    label: "Checking portfolio risk",
    description: "Reviewing drawdown, concentration, and active alerts before sizing risk.",
  },
  {
    id: "synthesis",
    label: "Synthesizing recommendation",
    description: "Combining TA, market context, and risk into one portfolio-level call.",
  },
];

export function usePortfolioAIAnalysis(scopeKey?: string | null): UsePortfolioAIAnalysisResult {
  const [recommendation, setRecommendation] = useState<PortfolioAIRecommendation | null>(null);
  const [isAnalyzing, setAnalyzing] = useState(false);
  const [activeStepId, setActiveStepId] = useState<AIAnalysisStepId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const runIdRef = useRef(0);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    runIdRef.current += 1;
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current = [];
    setRecommendation(null);
    setAnalyzing(false);
    setActiveStepId(null);
    setError(null);
  }, [scopeKey]);

  const analyze = async (input: AnalyzeInput) => {
    if (!input.snapshot || isAnalyzing) {
      return;
    }

    runIdRef.current += 1;
    const currentRunId = runIdRef.current;
    const stepAdvanceState = { currentIndex: 0 };

    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current = [];
    setAnalyzing(true);
    setError(null);
    setActiveStepId(STEPS[0].id);

    const advanceStep = () => {
      if (runIdRef.current !== currentRunId) {
        return;
      }

      const nextIndex = Math.min(stepAdvanceState.currentIndex + 1, STEPS.length - 1);
      stepAdvanceState.currentIndex = nextIndex;
      setActiveStepId(STEPS[nextIndex].id);

      if (nextIndex < STEPS.length - 1) {
        const timeoutId = window.setTimeout(advanceStep, STEP_DELAY_MS);
        timeoutIdsRef.current.push(timeoutId);
      }
    };

    const firstTimeoutId = window.setTimeout(advanceStep, STEP_DELAY_MS);
    timeoutIdsRef.current.push(firstTimeoutId);

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          portfolioName: input.portfolioName,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { recommendation?: PortfolioAIRecommendation; error?: string }
        | null;

      if (runIdRef.current !== currentRunId) {
        return;
      }

      if (!response.ok || !payload?.recommendation) {
        throw new Error(payload?.error || `AI analysis failed (${response.status})`);
      }

      setActiveStepId(STEPS[STEPS.length - 1].id);
      setRecommendation(payload.recommendation);

      const finishTimeoutId = window.setTimeout(() => {
        if (runIdRef.current !== currentRunId) {
          return;
        }

        setAnalyzing(false);
        setActiveStepId(null);
      }, STEP_DELAY_MS);

      timeoutIdsRef.current.push(finishTimeoutId);
    } catch (analyzeError) {
      if (runIdRef.current !== currentRunId) {
        return;
      }

      setError(analyzeError instanceof Error ? analyzeError.message : "Unable to analyze portfolio with AI.");
      setAnalyzing(false);
      setActiveStepId(null);
    }
  };

  return {
    recommendation,
    isAnalyzing,
    activeStepId,
    error,
    analyze,
    steps: STEPS,
  };
}
