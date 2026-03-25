"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { PortfolioAIRecommendation } from "@/app/lib/portfolio-types";
import type { AIAnalysisStep, AIAnalysisStepId } from "@/app/hooks/use-portfolio-ai-analysis";
import { MaterialIcon } from "../dashboard/material-icon";

type AIPortfolioRecommendationDashboardProps = {
  recommendation: PortfolioAIRecommendation | null;
  isAnalyzing: boolean;
  activeStepId: AIAnalysisStepId | null;
  steps: AIAnalysisStep[];
  error: string | null;
  onAnalyze: () => void;
  isDisabled?: boolean;
};

type MarketFactId =
  | "portfolio_value"
  | "btc_live_price"
  | "top_allocation"
  | "volume_24h"
  | "risk_score"
  | "all_time_pnl";

type MarketFact = {
  id: MarketFactId;
  label: string;
  value: string;
  accent: "danger" | "success" | "info";
};

type AgentAccordion = {
  id: "technical" | "context" | "risk";
  label: string;
  tone: "success" | "neutral" | "danger";
  summary: string;
  bullets: string[];
};

const MOCK_FACTS: MarketFact[] = [
  { id: "portfolio_value", label: "Portfolio Value", value: "$64,717", accent: "info" },
  { id: "btc_live_price", label: "BTC Live Price", value: "$70,301", accent: "info" },
  { id: "top_allocation", label: "Top Allocation", value: "BNB 99.99%", accent: "danger" },
  { id: "volume_24h", label: "24H Volume", value: "$68,854,165", accent: "success" },
  { id: "risk_score", label: "Risk Score", value: "67.5/100", accent: "danger" },
  { id: "all_time_pnl", label: "All-Time PnL", value: "-59.86%", accent: "danger" },
];

const AGENT_ACCORDIONS: AgentAccordion[] = [
  {
    id: "technical",
    label: "Technical View",
    tone: "success",
    summary: "Momentum remains intact on majors, but this portfolio is over-concentrated in one driver.",
    bullets: [
      "BTC structure still trends above higher-timeframe support.",
      "BNB exposure dominates realized and unrealized portfolio swings.",
      "Risk-adjusted upside is weaker than the current concentration implies.",
    ],
  },
  {
    id: "context",
    label: "Market Context",
    tone: "neutral",
    summary: "Macro tone is mixed, with liquidity supportive but single-asset concentration leaving little room for error.",
    bullets: [
      "Broader crypto risk appetite is stable rather than euphoric.",
      "Portfolio cash coverage is effectively zero during a volatile regime.",
      "A diversified stance would better absorb headline-driven moves.",
    ],
  },
  {
    id: "risk",
    label: "Risk Manager View",
    tone: "danger",
    summary: "Current structure breaches diversification discipline and warrants immediate defensive action.",
    bullets: [
      "Concentration risk is the dominant threat, not directional thesis quality.",
      "A small adverse move in BNB has an outsized effect on total NAV.",
      "Reducing exposure and defining a hard stop is the cleanest defensive response.",
    ],
  },
];

const PROCESSING_AGENTS = [
  {
    id: "ta",
    label: "Quant / TA Agent",
    icon: "query_stats",
    aura: "from-emerald-400/25 via-emerald-400/6 to-transparent",
  },
  {
    id: "news",
    label: "Macro / News Agent",
    icon: "public",
    aura: "from-sky-400/25 via-sky-400/6 to-transparent",
  },
  {
    id: "risk",
    label: "Risk Agent",
    icon: "shield",
    aura: "from-rose-500/25 via-rose-500/8 to-transparent",
  },
] as const;

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Today, 14:18";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function factAccentClasses(accent: MarketFact["accent"], highlighted: boolean, dimmed: boolean): string {
  const base =
    accent === "danger"
      ? "border-rose-500/20 shadow-[0_0_0_1px_rgba(244,63,94,0.08)]"
      : accent === "success"
        ? "border-emerald-400/15 shadow-[0_0_0_1px_rgba(52,211,153,0.06)]"
        : "border-sky-400/15 shadow-[0_0_0_1px_rgba(56,189,248,0.06)]";

  if (highlighted) {
    return `${base} scale-[1.02] border-primary/55 shadow-[0_0_0_1px_rgba(96,165,250,0.38),0_0_30px_rgba(59,130,246,0.18)]`;
  }

  if (dimmed) {
    return `${base} opacity-40`;
  }

  return `${base} opacity-100`;
}

function accordionToneClasses(tone: AgentAccordion["tone"]): string {
  if (tone === "success") {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  }

  if (tone === "danger") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-200";
  }

  return "border-sky-400/25 bg-sky-500/10 text-sky-200";
}

function ConfidenceGauge({ value }: { value: number }) {
  const bounded = Math.max(0, Math.min(10, value));
  const progress = (bounded / 10) * 100;

  return (
    <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-[#101620]">
      <div
        className="absolute inset-1 rounded-full"
        style={{
          background: `conic-gradient(rgba(103,232,249,0.88) ${progress * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
        }}
      />
      <div className="absolute inset-2 rounded-full bg-[#0a0f18]" />
      <div className="relative text-center">
        <div className="text-[1.05rem] font-bold leading-none text-white">{bounded}</div>
        <div className="mt-0.5 text-[0.55rem] uppercase tracking-[0.24em] text-slate-400">conf</div>
      </div>
    </div>
  );
}

function ActionCard({
  title,
  primary,
  secondary,
  buttonLabel,
  icon,
}: {
  title: string;
  primary: string;
  secondary?: string;
  buttonLabel: string;
  icon: string;
}) {
  const handleAction = () => {
    window.alert("Feature Coming Soon: This is a decision-support tool. Manual execution is required.");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText([primary, secondary].filter(Boolean).join(" | "));
      window.alert("Setup copied to clipboard.");
    } catch {
      window.alert("Unable to copy setup values.");
    }
  };

  return (
    <article className="relative overflow-hidden rounded-[1.5rem] border border-white/8 bg-[#0d131d] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.12),transparent_25%)]" />
      <div className="relative">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
            <p className="mt-3 text-xl font-semibold leading-snug text-white">{primary}</p>
            {secondary ? <p className="mt-2 text-sm text-slate-400">{secondary}</p> : null}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-sky-400/40 hover:text-white"
            aria-label="Copy setup values"
          >
            <MaterialIcon name={icon} outlined={false} className="text-lg" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleAction}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(244,63,94,0.92),rgba(225,29,72,0.88))] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(244,63,94,0.22)] transition hover:brightness-110"
        >
          {buttonLabel}
        </button>
      </div>
    </article>
  );
}

export function AIPortfolioRecommendationDashboard({
  recommendation,
  isAnalyzing,
  activeStepId,
  steps,
  error,
  onAnalyze,
  isDisabled = false,
}: AIPortfolioRecommendationDashboardProps) {
  const reasoningRef = useRef<HTMLElement | null>(null);
  const [isCouncilProcessing, setCouncilProcessing] = useState(isAnalyzing);
  const [highlightedFactId, setHighlightedFactId] = useState<MarketFactId | null>(null);
  const [openAccordionId, setOpenAccordionId] = useState<AgentAccordion["id"] | null>("technical");

  useEffect(() => {
    if (isAnalyzing) {
      setCouncilProcessing(true);
      return;
    }

    if (!recommendation) {
      setCouncilProcessing(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCouncilProcessing(false);
    }, 380);

    return () => window.clearTimeout(timeoutId);
  }, [isAnalyzing, recommendation]);

  const activeStepLabel = steps.find((step) => step.id === activeStepId)?.label ?? "Parallel agent consensus";
  const displayConfidence = recommendation?.confidence ?? 9;
  const analyzedTime = formatTimestamp(recommendation?.analyzedAt);
  const snapshotTime = formatTimestamp(recommendation?.snapshotTimestamp);
  const showDecisionSections = Boolean(recommendation);

  const marketFacts = useMemo(() => MOCK_FACTS, []);

  const scrollToReasoning = () => {
    reasoningRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const reasoningTokens: Array<{ id: MarketFactId; text: string }> = [
    { id: "top_allocation", text: "99.99% allocation to BNB" },
    { id: "portfolio_value", text: "Portfolio value of $64,717" },
    { id: "risk_score", text: "Risk score at 67.5/100" },
    { id: "all_time_pnl", text: "all-time PnL of -59.86%" },
    { id: "volume_24h", text: "24H volume of $68,854,165" },
    { id: "btc_live_price", text: "BTC live price near $70,301" },
  ];

  return (
    <section className="relative mb-6 overflow-hidden rounded-[2rem] border border-white/8 bg-[#080d16] text-white shadow-[0_30px_90px_rgba(0,0,0,0.42)] lg:mb-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_25%),radial-gradient(circle_at_top_right,rgba(244,63,94,0.13),transparent_28%),linear-gradient(180deg,rgba(10,15,24,0.98),rgba(7,11,18,0.98))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.38),transparent)]" />

      <div className="relative px-5 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col gap-5">
          <header className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(14,20,31,0.96),rgba(9,14,22,0.98))] p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/25 bg-sky-400/10 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.18)]">
                    <MaterialIcon name="psychology" outlined={false} className="text-xl" />
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">AI Portfolio Recommendation</h3>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                      Portfolio-level recommendation built from parallel TA, market context, and risk agents.
                    </p>
                  </div>
                </div>

                {recommendation ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                      Confidence {displayConfidence}/10
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                      Analyzed {analyzedTime}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                      Snapshot {snapshotTime}
                    </span>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onAnalyze}
                disabled={isDisabled || isAnalyzing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.22),rgba(37,99,235,0.08))] px-5 py-3 text-sm font-semibold text-sky-100 shadow-[0_14px_36px_rgba(37,99,235,0.18)] transition hover:border-sky-300/35 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MaterialIcon name={isAnalyzing ? "hourglass_top" : "flash_on"} outlined={false} className="text-lg" />
                Analyze with AI
              </button>
            </div>

            {isCouncilProcessing ? (
              <div className="mt-5 rounded-[1.5rem] border border-white/8 bg-[#0a0f18] px-4 py-5 sm:px-5">
                <div className="grid gap-4 lg:grid-cols-3">
                  {PROCESSING_AGENTS.map((agent) => (
                    <article
                      key={agent.id}
                      className={`relative overflow-hidden rounded-[1.35rem] border border-white/8 bg-[#0d141f] p-4`}
                    >
                      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${agent.aura}`} />
                      <div className="relative">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
                            <MaterialIcon name={agent.icon} outlined={false} className="text-lg" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-white">{agent.label}</p>
                            <p className="mt-1 text-xs text-slate-400">Parallel analysis in progress</p>
                          </div>
                        </div>

                        <div className="mt-5 space-y-2">
                          <div className="h-3 w-4/5 animate-pulse rounded-full bg-white/10" />
                          <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/8" />
                          <div className="h-3 w-3/5 animate-pulse rounded-full bg-white/10" />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="my-4 hidden items-center justify-center lg:flex">
                  <svg viewBox="0 0 420 92" className="h-20 w-full max-w-4xl text-sky-300/45" aria-hidden>
                    <path d="M70 10 L70 42 L210 82" stroke="currentColor" strokeWidth="1.6" fill="none" strokeDasharray="6 7">
                      <animate attributeName="stroke-dashoffset" values="26;0" dur="1.3s" repeatCount="indefinite" />
                    </path>
                    <path d="M210 10 L210 82" stroke="currentColor" strokeWidth="1.6" fill="none" strokeDasharray="6 7">
                      <animate attributeName="stroke-dashoffset" values="26;0" dur="1.3s" repeatCount="indefinite" />
                    </path>
                    <path d="M350 10 L350 42 L210 82" stroke="currentColor" strokeWidth="1.6" fill="none" strokeDasharray="6 7">
                      <animate attributeName="stroke-dashoffset" values="26;0" dur="1.3s" repeatCount="indefinite" />
                    </path>
                  </svg>
                </div>

                <div className="mx-auto mt-3 flex max-w-sm items-center justify-center gap-3 rounded-full border border-sky-400/25 bg-[radial-gradient(circle,rgba(59,130,246,0.26),rgba(15,23,42,0.94))] px-5 py-3 text-center shadow-[0_0_28px_rgba(59,130,246,0.18)]">
                  <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300" />
                  <p className="text-sm font-semibold text-sky-100">Synthesizing Final Call...</p>
                </div>

                <p className="mt-4 text-center text-sm text-slate-400">{activeStepLabel}</p>
              </div>
            ) : recommendation ? (
              <div className="mt-5 rounded-[1.3rem] border border-rose-500/20 bg-[linear-gradient(90deg,rgba(127,29,29,0.34),rgba(62,9,18,0.12),rgba(10,15,24,0.94))] px-4 py-4 shadow-[0_0_0_1px_rgba(244,63,94,0.08),0_18px_40px_rgba(0,0,0,0.18)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center -space-x-2">
                      {[
                        { icon: "query_stats", className: "bg-sky-400/12 text-sky-100 shadow-[0_0_20px_rgba(59,130,246,0.18)]" },
                        { icon: "public", className: "bg-sky-400/12 text-sky-100 shadow-[0_0_20px_rgba(59,130,246,0.18)]" },
                        { icon: "shield", className: "bg-rose-500/18 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.22)]" },
                      ].map((item, index) => (
                        <span
                          key={item.icon}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 ${
                            index === 2 ? item.className : item.className
                          }`}
                        >
                          <MaterialIcon name={item.icon} outlined={false} className="text-base" />
                        </span>
                      ))}
                    </div>

                    <div>
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-rose-300/80">
                        Parallel consensus warning
                      </p>
                      <p className="mt-1 text-lg font-semibold text-rose-100 sm:text-xl">
                        SIGNAL: {recommendation.action.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <ConfidenceGauge value={displayConfidence} />
                    <button
                      type="button"
                      onClick={scrollToReasoning}
                      className="text-sm font-semibold text-sky-200 underline decoration-sky-400/40 underline-offset-4 transition hover:text-white"
                    >
                      View Reasoning &amp; Smart Actions
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[1.45rem] border border-dashed border-white/10 bg-[#0a0f18] px-5 py-6">
                <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sky-200">
                    <MaterialIcon name="auto_awesome" outlined={false} className="text-xl" />
                  </span>
                  <p className="mt-3 text-lg font-semibold text-white">No AI recommendation yet</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Run an analysis to generate a portfolio-level verdict, smart actions, and explainable evidence.
                  </p>
                </div>
              </div>
            )}

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}
          </header>

          {showDecisionSections ? (
            <>
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {marketFacts.map((fact) => {
                  const highlighted = highlightedFactId === fact.id;
                  const dimmed = highlightedFactId !== null && highlightedFactId !== fact.id;

                  return (
                    <article
                      key={fact.id}
                      className={`rounded-[1.45rem] border bg-[#0d131d] p-4 transition-all duration-200 ${factAccentClasses(
                        fact.accent,
                        highlighted,
                        dimmed,
                      )}`}
                      data-highlight-ready="true"
                    >
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-slate-500">{fact.label}</p>
                      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{fact.value}</p>
                    </article>
                  );
                })}
              </section>

              <section
                ref={reasoningRef}
                className="grid scroll-mt-6 grid-cols-1 gap-4 rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,15,24,0.98),rgba(8,12,20,0.98))] p-5 lg:grid-cols-[1.15fr_0.85fr] lg:p-6"
              >
                <article className="rounded-[1.4rem] border border-white/8 bg-[#0c121b] p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-semibold text-white">Detailed reasoning</h4>
                      <p className="mt-1 text-sm text-slate-400">Hover linked evidence to illuminate the affected market facts.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHighlightedFactId((current) => (current ? null : "top_allocation"))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:text-white"
                      aria-label="Toggle evidence highlight"
                    >
                      <MaterialIcon name="track_changes" outlined={false} className="text-lg" />
                    </button>
                  </div>

                  <p className="text-sm leading-8 text-slate-300 sm:text-[0.96rem]">
                    The council flags severe concentration because the portfolio is effectively carrying{" "}
                    {reasoningTokens.map((token, index) => (
                      <span key={token.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setHighlightedFactId(token.id)}
                          onMouseLeave={() => setHighlightedFactId(null)}
                          onFocus={() => setHighlightedFactId(token.id)}
                          onBlur={() => setHighlightedFactId(null)}
                          onClick={() => setHighlightedFactId((current) => (current === token.id ? null : token.id))}
                          className="inline-flex rounded-lg border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-xs font-semibold text-sky-100 transition hover:border-sky-300/45 hover:bg-sky-400/18"
                        >
                          [{token.text}]
                        </button>
                        {index === 0 && " with "}
                        {index === 1 && ", while "}
                        {index === 2 && " combines with "}
                        {index === 3 && " despite "}
                        {index === 4 && " and "}
                        {index === 5 && " to support a defensive recommendation. "}
                      </span>
                    ))}
                    The model consensus concludes that preserving optionality matters more than chasing incremental upside until exposure is reduced and protection is defined.
                  </p>
                </article>

                <article className="rounded-[1.4rem] border border-white/8 bg-[#0c121b] p-4">
                  <div className="mb-3">
                    <h4 className="text-lg font-semibold text-white">Agent views</h4>
                    <p className="mt-1 text-sm text-slate-400">Open each agent pane to inspect its contribution to the final call.</p>
                  </div>

                  <div className="space-y-3">
                    {AGENT_ACCORDIONS.map((accordion) => {
                      const isOpen = accordion.id === openAccordionId;

                      return (
                        <section key={accordion.id} className="rounded-[1.2rem] border border-white/8 bg-[#101722]">
                          <button
                            type="button"
                            onClick={() => setOpenAccordionId(isOpen ? null : accordion.id)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] ${accordionToneClasses(accordion.tone)}`}>
                                  {accordion.label}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-slate-300">{accordion.summary}</p>
                            </div>
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200">
                              <MaterialIcon
                                name={isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
                                outlined={false}
                                className="text-lg"
                              />
                            </span>
                          </button>

                          {isOpen ? (
                            <div className="border-t border-white/8 px-4 py-4">
                              <div className="space-y-2 text-sm text-slate-300">
                                {accordion.bullets.map((bullet) => (
                                  <p key={bullet} className="rounded-xl border border-white/6 bg-white/[0.04] px-3 py-2">
                                    {bullet}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                </article>
              </section>

              <section className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,17,27,0.98),rgba(8,12,20,0.98))] p-5 lg:p-6">
                <div className="mb-5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Decision Support &amp; Future Simulation</p>
                  <h4 className="mt-2 text-2xl font-semibold tracking-tight text-white">Actionable spot-trading simulation</h4>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <ActionCard
                    title="Immediate Action"
                    primary="Target: Sell 25% of BNBUSDT"
                    secondary="Ref Price: ~$600.00"
                    buttonLabel="Place Sell Order"
                    icon="content_copy"
                  />
                  <ActionCard
                    title="Defensive Setup"
                    primary="Hard Stop-Loss at $580.00"
                    buttonLabel="Configure Stop-Loss"
                    icon="content_copy"
                  />
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
