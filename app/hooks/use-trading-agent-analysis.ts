"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { PortfolioAIRecommendation } from "@/app/lib/portfolio-types";
import type {
  TradingAgentPreparedContext,
  TradingAgentResult,
  TradingAgentStepEvent,
  TradingAgentStreamDoneEvent,
  TradingAgentStreamErrorEvent,
  TradingAgentStreamStartEvent,
  TradingAgentTraceEvent,
} from "@/app/lib/trading-agent-types";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

type TradingAgentRunStatus = "idle" | "streaming" | "completed" | "error";

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

function humanizeNodeLabel(node: string): string {
  return node
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n"),
  };
}

export function useTradingAgentAnalysis(scopeKey?: string | null): UseTradingAgentAnalysisResult {
  const [recommendation, setRecommendation] = useState<PortfolioAIRecommendation | null>(null);
  const [latestResult, setLatestResult] = useState<TradingAgentResult | null>(null);
  const [preparedContext, setPreparedContext] = useState<TradingAgentPreparedContext | null>(null);
  const [trace, setTrace] = useState<TradingAgentTraceEvent[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState<TradingAgentRunStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeNodes, setActiveNodes] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    abortControllerRef.current?.abort();
    setRecommendation(null);
    setLatestResult(null);
    setTrace([]);
    setWarnings([]);
    setStatus("idle");
    setError(null);
    setActiveNodes([]);
    setPreparedContext(null);

    const loadLatestRecommendation = async () => {
      if (!scopeKey?.trim()) {
        return;
      }

      try {
        const response = await fetch(`/api/ai/analyze-trading-agent?portfolioName=${encodeURIComponent(scopeKey)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { recommendation?: PortfolioAIRecommendation | null }
          | null;

        if (isCancelled || !response.ok) {
          return;
        }

        setRecommendation(payload?.recommendation ?? null);
      } catch {
        return;
      }
    };

    void loadLatestRecommendation();

    return () => {
      isCancelled = true;
    };
  }, [scopeKey]);

  const analyze = async ({ portfolioName }: AnalyzeInput) => {
    if (!portfolioName.trim() || status === "streaming") {
      return;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setStatus("streaming");
    setError(null);
    setTrace([]);
    setWarnings([]);
    setActiveNodes([]);
    setLatestResult(null);
    setPreparedContext(null);

    try {
      const response = await fetchWithSupabaseAuth("/api/ai/analyze-trading-agent/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ portfolioName }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `Trading agent stream failed (${response.status})`);
      }

      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = "";
      let didComplete = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let separatorIndex = buffer.indexOf("\n\n");

        while (separatorIndex !== -1) {
          const block = buffer.slice(0, separatorIndex).trim();
          buffer = buffer.slice(separatorIndex + 2);

          if (block) {
            const parsed = parseSseBlock(block);
            if (parsed) {
              const parsedPayload = JSON.parse(parsed.data) as
                | TradingAgentStreamStartEvent
                | TradingAgentStepEvent
                | TradingAgentStreamDoneEvent
                | TradingAgentStreamErrorEvent;

              if (parsed.event === "start") {
                setStatus("streaming");
              }

              if (parsed.event === "step") {
                const stepPayload = parsedPayload as TradingAgentStepEvent;
                setActiveNodes(stepPayload.nodes);
                setTrace(stepPayload.trace);
                setWarnings(stepPayload.warnings);
                if (stepPayload.state?.prepared_context) {
                  setPreparedContext(stepPayload.state.prepared_context);
                }
              }

              if (parsed.event === "done") {
                const donePayload = parsedPayload as TradingAgentStreamDoneEvent;
                setRecommendation(donePayload.recommendation);
                setLatestResult(donePayload.result);
                setTrace(donePayload.result.trace);
                setWarnings(donePayload.result.warnings);
                setActiveNodes([]);
                setError(donePayload.result.error || donePayload.warning);
                setStatus(donePayload.result.status === "error" ? "error" : "completed");
                didComplete = true;
              }

              if (parsed.event === "error") {
                const errorPayload = parsedPayload as TradingAgentStreamErrorEvent;
                throw new Error(errorPayload.message || "Trading agent stream failed.");
              }
            }
          }

          separatorIndex = buffer.indexOf("\n\n");
        }
      }

      if (!didComplete && !abortController.signal.aborted) {
        throw new Error("Trading agent stream ended before a final result arrived.");
      }
    } catch (streamError) {
      if (abortController.signal.aborted) {
        return;
      }

      setActiveNodes([]);
      setStatus("error");
      setError(streamError instanceof Error ? streamError.message : "Unable to stream trading agent analysis.");
    }
  };

  const progressLabel = useMemo(() => {
    if (status === "streaming" && activeNodes.length > 0) {
      return `${humanizeNodeLabel(activeNodes[0])} in progress`;
    }

    if (status === "completed" && recommendation) {
      return "Analysis complete";
    }

    if (status === "error") {
      return "Stream interrupted";
    }

    return "Ready to analyze";
  }, [activeNodes, recommendation, status]);

  return {
    recommendation,
    latestResult,
    preparedContext,
    trace,
    warnings,
    isAnalyzing: status === "streaming",
    status,
    error,
    activeNodes,
    progressLabel,
    completedSteps: trace.filter((item) => item.status === "completed").length,
    totalSteps: TOTAL_STEPS,
    analyze,
  };
}
