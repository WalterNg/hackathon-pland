"use client";

import { useEffect, useRef, useState } from "react";

import type {
  PortfolioAIRecommendation,
  PortfolioMetrics,
  PortfolioSummary as PortfolioSummaryType,
} from "@/app/lib/portfolio-types";
import type {
  TradingAgentPreparedContext,
  TradingAgentResult,
  TradingAgentTraceEvent,
} from "@/app/lib/trading-agent-types";
import { MaterialIcon } from "../dashboard/material-icon";
import { TradingAgentTraceModal } from "./trading-agent-trace-modal";

type PortfolioSummaryProps = {
  portfolioName: string;
  summary: PortfolioSummaryType;
  metrics: PortfolioMetrics;
  tradingAgentRecommendation: PortfolioAIRecommendation | null;
  tradingAgentResult: TradingAgentResult | null;
  tradingAgentPreparedContext: TradingAgentPreparedContext | null;
  tradingAgentTrace: TradingAgentTraceEvent[];
  tradingAgentWarnings: string[];
  tradingAgentIsAnalyzing: boolean;
  tradingAgentProgressLabel: string;
  tradingAgentActiveNodes: string[];
  tradingAgentError: string | null;
  onAnalyzeTradingAgent: () => void;
  isAnalyzeDisabled?: boolean;
};

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------*/
const STEP_LABELS: Record<string, string> = {
  validate_inputs: "Validating inputs",
  prepare_context: "Preparing market context",
  technical_analyst: "Running technical analysis",
  news_analyst: "Scanning market news",
  sentiment_analyst: "Measuring market sentiment",
  portfolio_structure_analyst: "Analysing portfolio structure",
  bull_researcher: "Building bullish case",
  bear_researcher: "Building bearish case",
  investment_manager: "Synthesising investment stance",
  trader: "Drafting trade proposal",
  aggressive_risk_analyst: "Evaluating aggressive risk view",
  conservative_risk_analyst: "Evaluating conservative risk view",
  neutral_risk_analyst: "Evaluating neutral risk view",
  risk_judge: "Judging final risk level",
  guardrails: "Applying safety guardrails",
  finalize_response: "Finalising recommendation",
};

function sl(step: string) {
  return STEP_LABELS[step] ?? step.replace(/_/g, " ");
}

function actionTheme(action: string) {
  if (action === "Accumulate") {
    return {
      heroBorder: "border-emerald-500/25",
      heroBg: "bg-emerald-500/[0.03]",
      actionText: "text-emerald-300",
      accentText: "text-emerald-400",
      accentDot: "bg-emerald-500/50",
      actionLabel: "text-emerald-300/70",
    };
  }

  if (action === "Reduce Risk" || action === "Stop Loss") {
    return {
      heroBorder: "border-rose-500/25",
      heroBg: "bg-rose-500/[0.03]",
      actionText: "text-rose-300",
      accentText: "text-rose-400",
      accentDot: "bg-rose-500/50",
      actionLabel: "text-rose-300/70",
    };
  }

  if (action === "Rebalance") {
    return {
      heroBorder: "border-amber-500/25",
      heroBg: "bg-amber-500/[0.03]",
      actionText: "text-amber-300",
      accentText: "text-amber-400",
      accentDot: "bg-amber-500/50",
      actionLabel: "text-amber-300/70",
    };
  }

  return {
    heroBorder: "border-sky-500/20",
    heroBg: "bg-sky-500/[0.03]",
    actionText: "text-sky-200",
    accentText: "text-sky-300",
    accentDot: "bg-sky-400/50",
    actionLabel: "text-sky-200/70",
  };
}

/* ---------------------------------------------------------------------------
 * ThinkingStrip — left side mini thinking feed during analysis
 * -------------------------------------------------------------------------*/
type ThinkingStripProps = {
  trace: TradingAgentTraceEvent[];
  activeNodes: string[];
};

function ThinkingStrip({ trace, activeNodes }: ThinkingStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Steps currently executing (blue line — shown regardless of trace state)
  const activeSet = new Set(activeNodes);

  // Completed history = all finished steps NOT currently active
  const completedSteps = trace.filter(
    (evt) =>
      (evt.status === "completed" || evt.status === "error" || evt.status === "skipped") &&
      !activeSet.has(evt.step)
  );

  const activeStep = activeNodes[0];

  // Auto-scroll to bottom when new steps arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [completedSteps.length, activeStep]);

  return (
    <div
      ref={scrollRef}
      className="mt-2.5 space-y-1.5 max-h-[5.25rem] overflow-y-auto pr-2 custom-scrollbar scroll-smooth [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20"
    >
      {/* Completed steps — green ticks */}
      {completedSteps.map((evt, i) => (
        <div
          key={`${evt.step}-${i}`}
          className="flex items-center gap-2 animate-[fadeSlideIn_0.2s_ease_both]"
        >
          <MaterialIcon
            name={evt.status === "error" ? "close" : "check_circle"}
            outlined={false}
            className={[
              "shrink-0 text-[0.85rem]",
              evt.status === "error" ? "text-rose-400" : "text-emerald-500/70",
            ].join(" ")}
          />
          <span className={[
            "truncate text-[0.76rem] font-medium",
            evt.status === "error" ? "text-rose-300/90" : "text-slate-400",
          ].join(" ")}>
            {sl(evt.step)}
          </span>
        </div>
      ))}

      {/* Active step — blue pulsing dot */}
      {activeStep && (
        <div className="flex items-center gap-2 animate-[fadeSlideIn_0.2s_ease_both]">
          <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
            <span className="absolute h-full w-full animate-ping rounded-full bg-sky-400/40" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-sky-400" />
          </span>
          <span className="truncate text-[0.76rem] font-semibold text-sky-400">
            {sl(activeStep)}
            <span className="ml-1.5 inline-flex gap-0.5 opacity-80">
              <span className="h-1 w-1 animate-bounce rounded-full bg-sky-400 [animation-duration:0.8s] [animation-delay:0ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-sky-400 [animation-duration:0.8s] [animation-delay:150ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-sky-400 [animation-duration:0.8s] [animation-delay:300ms]" />
            </span>
          </span>
        </div>
      )}
    </div>
  );
}


/* ---------------------------------------------------------------------------
 * AIInsightPanel — Structured AI result display
 * -------------------------------------------------------------------------*/
type AIInsightPanelProps = {
  recommendation: PortfolioAIRecommendation;
  result: TradingAgentResult | null;
};

function AIInsightPanel({ recommendation, result }: AIInsightPanelProps) {
  const tone = actionTheme(recommendation.action);
  
  // Custom title based on action
  const getDisplayTitle = () => {
    if (recommendation.action === "Stop Loss") return "⚠️ Portfolio Structural Risk";
    if (recommendation.action === "Reduce Risk") return "⚡ High Volatility Exposure";
    if (recommendation.action === "Rebalance") return "⚖️ Allocation Imbalance";
    if (recommendation.action === "Accumulate") return "🚀 Growth Opportunity";
    return "💡 Portfolio Insight";
  };

  const getRiskColor = (score: number) => {
    if (score >= 8) return "bg-rose-500/20 text-rose-400 border-rose-500/30";
    if (score >= 5) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  };

  // Derive granular content from result (the "Expand" data)
  const portfolioStructure = result?.analyst_reports?.portfolio_structure;
  const traderProposal = result?.trader_proposal;

  // 1. Issues: Combine reasonings with structure summary
  const issues = [
    ...(portfolioStructure?.summary ? [portfolioStructure.summary] : []),
    ...recommendation.reasoning
  ];

  // 2. Actions: Prioritize trader implementation steps
  const actions = [
    ...(traderProposal?.implementation_steps ?? []),
    ...(portfolioStructure?.actions ?? []),
    ...(traderProposal?.implementation_steps ? [] : recommendation.portfolioActions)
  ].filter((v, i, a) => a.indexOf(v) === i); // Deduplicate

  void getDisplayTitle;
  void getRiskColor;
  void issues;
  void actions;

  return (
    <div className="space-y-4">
      {/* 1. Header with Risk Score */}
      {/* 2. Decision Hero Box — The primary stance */}
      <div className={`rounded-2xl border bg-[#0d1117] p-5 shadow-inner ${tone.heroBorder} ${tone.heroBg}`}>
        <div className="flex flex-col gap-1">
          <p className={`text-[0.7rem] font-bold uppercase tracking-[0.2em] ${tone.actionLabel}`}>Recommended Action</p>
          <h4 className={`text-3xl font-bold tracking-tight ${tone.actionText}`}>{recommendation.action}</h4>
          <p className="mt-2 text-[0.82rem] leading-relaxed text-slate-300">
            {recommendation.summary}
          </p>
        </div>
      </div>

      {/* 3. Detailed Evidence Grid */}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * PortfolioSummary
 * -------------------------------------------------------------------------*/
export function PortfolioSummary({
  portfolioName,
  summary,
  metrics,
  tradingAgentRecommendation,
  tradingAgentResult,
  tradingAgentPreparedContext,
  tradingAgentTrace,
  tradingAgentWarnings,
  tradingAgentIsAnalyzing,
  tradingAgentProgressLabel,
  tradingAgentActiveNodes,
  tradingAgentError,
  onAnalyzeTradingAgent,
  isAnalyzeDisabled = false,
}: PortfolioSummaryProps) {
  const [isTraceOpen, setTraceOpen] = useState(false);

  const usdFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  const totalValueUsdLabel = usdFormatter.format(summary.totalValueUsd);
  const isProfitPositive = metrics.allTimeProfitPercent >= 0;
  const allTimeProfitPercentLabel = `${isProfitPositive ? "+" : ""}${metrics.allTimeProfitPercent.toFixed(2)}%`;

  const hasRecommendation = !!tradingAgentRecommendation && !tradingAgentIsAnalyzing;

  return (
    <section className="mb-5 border-t border-white/10 pt-4 text-inverse sm:pt-5 lg:mb-6 lg:pt-6">
      {/* Content Container (no outer visual frame) */}
      <div className="p-0">
        
        {/* Card Header: Metrics (Left) + CTA (Right) */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1">
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-slate-500">
                Total Portfolio Value
              </span>
            </div>
            
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {totalValueUsdLabel}
              </h2>
              
              <div className={`flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 ${isProfitPositive ? "text-emerald-400" : "text-rose-400"}`}>
                <MaterialIcon
                  name={isProfitPositive ? "arrow_upward" : "arrow_downward"}
                  outlined={false}
                  className="text-[0.7rem]"
                />
                <span className="text-[0.78rem] font-bold">{allTimeProfitPercentLabel}</span>
              </div>
            </div>
          </div>

          {/* CTA: Large Primary (Initial) or Compact Secondary (Re-analyze) */}
          <div className="flex shrink-0 items-center gap-2">
            {!hasRecommendation || tradingAgentIsAnalyzing ? (
              <div className="relative">
                {tradingAgentIsAnalyzing && (
                  <span className="pointer-events-none absolute inset-0 rounded-2xl bg-sky-400/20 blur-md animate-pulse" />
                )}
                <button
                  type="button"
                  id="analyze-with-ai-btn"
                  onClick={onAnalyzeTradingAgent}
                  disabled={isAnalyzeDisabled || tradingAgentIsAnalyzing}
                  className={[
                    "group relative inline-flex items-center gap-2.5 overflow-hidden",
                    "rounded-2xl px-5 py-2.5",
                    "text-[0.85rem] font-bold tracking-wide text-white",
                    "shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_4px_24px_rgba(14,165,233,0.3)]",
                    "transition-all duration-300",
                    "hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_8px_32px_rgba(99,102,241,0.5)]",
                    "hover:scale-[1.02] active:scale-[0.97]",
                    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
                    "bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600",
                  ].join(" ")}
                >
                   <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-15deg] bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-1000 group-hover:translate-x-full"
                  />
                  {tradingAgentIsAnalyzing ? (
                    <span className="relative flex h-3 w-3 items-center justify-center">
                      <span className="absolute h-3 w-3 animate-ping rounded-full bg-white/40" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                  ) : (
                    <MaterialIcon name="auto_awesome" outlined={false} className="text-[0.9rem] text-white/90" />
                  )}
                  <span className="relative">
                    {tradingAgentIsAnalyzing ? "Analyzing..." : "Analyze with AI"}
                  </span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onAnalyzeTradingAgent}
                disabled={isAnalyzeDisabled}
                className="group inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[0.78rem] font-bold text-slate-300 transition-all hover:bg-white/[0.1] hover:text-white"
              >
                <MaterialIcon name="refresh" outlined={false} className="text-[0.85rem] transition-transform group-hover:rotate-180 duration-500" />
                <span>Re-analyze</span>
              </button>
            )}
            
            <button
              type="button"
              onClick={() => setTraceOpen(true)}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
              title="View full trace logs"
            >
              <MaterialIcon name="open_in_full" outlined={false} className="text-[0.85rem]" />
            </button>
          </div>
        </div>

        {/* Card Body: Thinking Strip OR Search Result Insight */}
        <div className="mt-6">
          {/* 1. Thinking — Hide when done */}
          {tradingAgentIsAnalyzing && (
             <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 animate-[fadeSlideIn_0.3s_ease_both]">
               <ThinkingStrip
                  trace={tradingAgentTrace}
                  activeNodes={tradingAgentActiveNodes}
               />
             </div>
          )}

          {/* 2. AI Analysis Insight — Show when ready */}
          {hasRecommendation && (
            <div className="animate-[fadeSlideIn_0.4s_ease_both]">
              <AIInsightPanel 
                recommendation={tradingAgentRecommendation!}
                result={tradingAgentResult}
              />
            </div>
          )}

          {/* 3. Empty/Getting started */}
          {!tradingAgentIsAnalyzing && !tradingAgentRecommendation && !tradingAgentError && tradingAgentTrace.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] py-10">
               <div className="mb-3 rounded-full bg-white/5 p-3 text-slate-500">
                  <MaterialIcon name="auto_awesome" outlined={false} className="text-2xl" />
               </div>
               <p className="max-w-[280px] text-center text-[0.82rem] leading-relaxed text-slate-500">
                  Take full control of your strategy. Let AI scan your entire portfolio for risks and opportunities.
               </p>
            </div>
          )}

          {/* 4. Error state */}
          {!tradingAgentIsAnalyzing && tradingAgentError && !tradingAgentRecommendation && (
             <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-rose-300">
                <MaterialIcon name="error" outlined={false} className="text-lg" />
                <span className="text-[0.82rem]">{tradingAgentError}</span>
             </div>
          )}
        </div>
      </div>

      <TradingAgentTraceModal
        open={isTraceOpen}
        onClose={() => setTraceOpen(false)}
        result={tradingAgentResult}
        preparedContext={tradingAgentPreparedContext}
        trace={tradingAgentTrace}
        activeNodes={tradingAgentActiveNodes}
        isAnalyzing={tradingAgentIsAnalyzing}
        progressLabel={tradingAgentProgressLabel}
        portfolioName={portfolioName}
        warnings={tradingAgentWarnings}
        error={tradingAgentError}
      />
    </section>
  );
}
