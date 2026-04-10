"use client";

import { useMemo, useState } from "react";

import type { PortfolioAIRecommendation } from "@/app/lib/portfolio-types";
import type { TradingAgentResult, TradingAgentTraceEvent } from "@/app/lib/trading-agent-types";
import { MaterialIcon } from "../dashboard/material-icon";
import { TradingAgentTraceModal } from "./trading-agent-trace-modal";

type TradingAgentDecisionCardProps = {
  portfolioName: string;
  recommendation: PortfolioAIRecommendation | null;
  result: TradingAgentResult | null;
  trace: TradingAgentTraceEvent[];
  warnings: string[];
  isAnalyzing: boolean;
  progressLabel: string;
  completedSteps: number;
  totalSteps: number;
  activeNodes: string[];
  preparedContext: import("@/app/lib/trading-agent-types").TradingAgentPreparedContext | null;
  error: string | null;
  onAnalyze: () => void;
  isDisabled?: boolean;
};

function actionTone(action: PortfolioAIRecommendation["action"] | "Pending") {
  if (action === "Accumulate") {
    return "text-success-soft";
  }
  if (action === "Reduce Risk" || action === "Stop Loss") {
    return "text-rose-300";
  }
  if (action === "Rebalance") {
    return "text-amber-300";
  }
  return "text-slate-100";
}

export function TradingAgentDecisionCard({
  portfolioName,
  recommendation,
  result,
  trace,
  warnings,
  isAnalyzing,
  progressLabel,
  completedSteps,
  totalSteps,
  activeNodes,
  preparedContext,
  error,
  onAnalyze,
  isDisabled = false,
}: TradingAgentDecisionCardProps) {
  const [isModalOpen, setModalOpen] = useState(false);

  const decisionLabel = recommendation?.action ?? "Pending";
  const decisionSummary = recommendation?.summary ?? "Run the multi-agent workflow to produce a recommendation.";
  const confidenceLabel = recommendation ? `Confidence ${recommendation.confidence}/10` : "No decision yet";

  const compactTraceLabel = useMemo(() => {
    if (isAnalyzing) {
      return `${Math.min(completedSteps, totalSteps)} of ${totalSteps} steps completed`;
    }

    if (trace.length > 0) {
      return `${trace.length} trace events captured`;
    }

    return "Trace opens in modal";
  }, [completedSteps, isAnalyzing, totalSteps, trace.length]);

  return (
    <>
      <section className="mb-6 rounded-[1.75rem] border border-white/10 bg-[#10141b] p-5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#161b23] text-slate-100">
                <MaterialIcon name="smart_toy" outlined={false} className="text-xl" />
              </span>
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Multi-Agent Analysis</p>
                <h3 className="mt-1 text-xl font-semibold text-white">Recommended decision</h3>
              </div>
            </div>

            <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-[#0d1117] px-4 py-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Current output</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className={`text-3xl font-semibold tracking-tight ${actionTone(decisionLabel)}`}>{decisionLabel}</p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{decisionSummary}</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                  {confidenceLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm">
            <div className="rounded-[1.4rem] border border-white/10 bg-[#0d1117] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">{progressLabel}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{compactTraceLabel}</p>
                </div>
                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isAnalyzing ? "animate-pulse bg-sky-300" : error ? "bg-rose-400" : "bg-success-indicator"}`} />
              </div>

              {warnings[0] ? (
                <p className="mt-3 text-sm text-amber-200">{warnings[0]}</p>
              ) : null}

              {error ? (
                <p className="mt-3 text-sm text-rose-200">{error}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onAnalyze}
                  disabled={isDisabled || isAnalyzing}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-[#171c24] px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-300/25 hover:bg-[#1b212b] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isAnalyzing ? "Streaming..." : "Analyze with AI"}
                </button>

                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-300/20 hover:bg-white/[0.03]"
                >
                  <MaterialIcon name="open_in_full" outlined={false} className="text-base" />
                  Expand
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <TradingAgentTraceModal
        open={isModalOpen}
        onClose={() => setModalOpen(false)}
        result={result}
        trace={trace}
        activeNodes={activeNodes}
        preparedContext={preparedContext}
        isAnalyzing={isAnalyzing}
        progressLabel={progressLabel}
        portfolioName={portfolioName}
        warnings={warnings}
        error={error}
      />
    </>
  );
}
