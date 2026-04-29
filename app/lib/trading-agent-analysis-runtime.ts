"use client";

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

export type TradingAgentRunStatus = "idle" | "streaming" | "completed" | "error";

export type TradingAgentAnalysisSnapshot = {
  recommendation: PortfolioAIRecommendation | null;
  latestResult: TradingAgentResult | null;
  preparedContext: TradingAgentPreparedContext | null;
  trace: TradingAgentTraceEvent[];
  warnings: string[];
  status: TradingAgentRunStatus;
  error: string | null;
  activeNodes: string[];
};

type TradingAgentRuntimeListener = (snapshot: TradingAgentAnalysisSnapshot) => void;

type TradingAgentRuntimeEntry = {
  snapshot: TradingAgentAnalysisSnapshot;
  listeners: Set<TradingAgentRuntimeListener>;
  streamAbortController: AbortController | null;
  streamPromise: Promise<void> | null;
};

type StartTradingAgentAnalysisOptions = {
  portfolioName: string;
  portfolioUiSessionId?: string | null;
  onRecommendationPersist?: (recommendation: PortfolioAIRecommendation) => void;
};

const EMPTY_SNAPSHOT: TradingAgentAnalysisSnapshot = {
  recommendation: null,
  latestResult: null,
  preparedContext: null,
  trace: [],
  warnings: [],
  status: "idle",
  error: null,
  activeNodes: [],
};

const runtimeEntries = new Map<string, TradingAgentRuntimeEntry>();

function cloneEmptySnapshot(): TradingAgentAnalysisSnapshot {
  return {
    ...EMPTY_SNAPSHOT,
    trace: [],
    warnings: [],
    activeNodes: [],
  };
}

function createRuntimeEntry(): TradingAgentRuntimeEntry {
  return {
    snapshot: cloneEmptySnapshot(),
    listeners: new Set<TradingAgentRuntimeListener>(),
    streamAbortController: null,
    streamPromise: null,
  };
}

function getRuntimeEntry(runtimeKey: string): TradingAgentRuntimeEntry {
  const existingEntry = runtimeEntries.get(runtimeKey);
  if (existingEntry) {
    return existingEntry;
  }

  const nextEntry = createRuntimeEntry();
  runtimeEntries.set(runtimeKey, nextEntry);
  return nextEntry;
}

function emitSnapshot(entry: TradingAgentRuntimeEntry) {
  for (const listener of entry.listeners) {
    listener(entry.snapshot);
  }
}

function updateSnapshot(
  runtimeKey: string,
  updater: (current: TradingAgentAnalysisSnapshot) => TradingAgentAnalysisSnapshot
) {
  const entry = getRuntimeEntry(runtimeKey);
  entry.snapshot = updater(entry.snapshot);
  emitSnapshot(entry);
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

export function buildTradingAgentRuntimeKey(
  scopeKey: string | null | undefined,
  portfolioId: string | null | undefined,
  portfolioUiSessionId: string | null | undefined
): string | null {
  const normalizedScopeKey = scopeKey?.trim();
  const normalizedPortfolioId = portfolioId?.trim();
  const normalizedSessionId = portfolioUiSessionId?.trim();

  if (!normalizedScopeKey || !normalizedPortfolioId || !normalizedSessionId) {
    return null;
  }

  return `${normalizedScopeKey}::${normalizedPortfolioId}::${normalizedSessionId}`;
}

export function getTradingAgentAnalysisSnapshot(
  runtimeKey: string | null
): TradingAgentAnalysisSnapshot {
  if (!runtimeKey) {
    return cloneEmptySnapshot();
  }

  return getRuntimeEntry(runtimeKey).snapshot;
}

export function subscribeTradingAgentAnalysis(
  runtimeKey: string,
  listener: TradingAgentRuntimeListener
): () => void {
  const entry = getRuntimeEntry(runtimeKey);
  entry.listeners.add(listener);
  listener(entry.snapshot);

  return () => {
    entry.listeners.delete(listener);
  };
}

export function primeTradingAgentAnalysis(
  runtimeKey: string,
  recommendation: PortfolioAIRecommendation | null,
  latestResult: TradingAgentResult | null,
  preparedContext: TradingAgentPreparedContext | null
) {
  const entry = getRuntimeEntry(runtimeKey);
  if (entry.snapshot.status === "streaming") {
    return;
  }

  entry.snapshot = recommendation
    ? {
        recommendation,
        latestResult,
        preparedContext,
        trace: latestResult?.trace ?? [],
        warnings: latestResult?.warnings ?? [],
        status: latestResult?.status === "error" ? "error" : "completed",
        error: latestResult?.error ?? null,
        activeNodes: [],
      }
    : cloneEmptySnapshot();
  emitSnapshot(entry);
}

export function isTradingAgentAnalysisStreaming(runtimeKey: string | null): boolean {
  if (!runtimeKey) {
    return false;
  }

  return getRuntimeEntry(runtimeKey).snapshot.status === "streaming";
}

export async function startTradingAgentAnalysis(
  runtimeKey: string,
  options: StartTradingAgentAnalysisOptions
): Promise<void> {
  const entry = getRuntimeEntry(runtimeKey);
  if (entry.streamPromise) {
    return entry.streamPromise;
  }

  const abortController = new AbortController();
  entry.streamAbortController = abortController;

  updateSnapshot(runtimeKey, (current) => ({
    ...current,
    latestResult: null,
    preparedContext: null,
    trace: [],
    warnings: [],
    status: "streaming",
    error: null,
    activeNodes: [],
  }));

  entry.streamPromise = (async () => {
    try {
      const response = await fetchWithSupabaseAuth("/api/ai/analyze-trading-agent/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          portfolioName: options.portfolioName,
          portfolioUiSessionId: options.portfolioUiSessionId,
        }),
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
                updateSnapshot(runtimeKey, (current) => ({
                  ...current,
                  status: "streaming",
                }));
              }

              if (parsed.event === "step") {
                const stepPayload = parsedPayload as TradingAgentStepEvent;
                updateSnapshot(runtimeKey, (current) => ({
                  ...current,
                  activeNodes: stepPayload.nodes,
                  trace: stepPayload.trace,
                  warnings: stepPayload.warnings,
                  preparedContext: stepPayload.state?.prepared_context ?? current.preparedContext,
                }));
              }

              if (parsed.event === "done") {
                const donePayload = parsedPayload as TradingAgentStreamDoneEvent;
                const currentPreparedContext = getRuntimeEntry(runtimeKey).snapshot.preparedContext;
                const nextRecommendation: PortfolioAIRecommendation = {
                  ...donePayload.recommendation,
                  analysisResult: donePayload.result,
                  preparedContext: currentPreparedContext,
                };

                updateSnapshot(runtimeKey, () => ({
                  recommendation: nextRecommendation,
                  latestResult: donePayload.result,
                  preparedContext: currentPreparedContext,
                  trace: donePayload.result.trace,
                  warnings: donePayload.result.warnings,
                  status: donePayload.result.status === "error" ? "error" : "completed",
                  error: donePayload.result.error || donePayload.warning,
                  activeNodes: [],
                }));

                options.onRecommendationPersist?.(nextRecommendation);
                didComplete = true;
              } else if (parsed.event === "error") {
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
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      updateSnapshot(runtimeKey, (current) => ({
        ...current,
        activeNodes: [],
        status: "error",
        error: error instanceof Error ? error.message : "Unable to stream trading agent analysis.",
      }));
    } finally {
      const currentEntry = getRuntimeEntry(runtimeKey);
      currentEntry.streamAbortController = null;
      currentEntry.streamPromise = null;
    }
  })();

  return entry.streamPromise;
}
