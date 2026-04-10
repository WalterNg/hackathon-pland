"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AIRecommendationActionCard, AIRecommendationActionPayload } from "@/app/lib/portfolio-ai-actions";
import type { PortfolioAIRecommendation } from "@/app/lib/portfolio-types";
import type { AIAnalysisStep, AIAnalysisStepId } from "@/app/hooks/use-portfolio-ai-analysis";
import type { RiskAlertRecord } from "@/app/lib/risk-types";
import { MaterialIcon } from "../dashboard/material-icon";

type AIPortfolioRecommendationDashboardProps = {
  recommendation: PortfolioAIRecommendation | null;
  actionCards: AIRecommendationActionCard[];
  alerts: RiskAlertRecord[];
  isAnalyzing: boolean;
  activeStepId: AIAnalysisStepId | null;
  steps: AIAnalysisStep[];
  error: string | null;
  actionFeedback: { tone: "success" | "error" | "info"; message: string } | null;
  onClearActionFeedback: () => void;
  onAction: (payload: AIRecommendationActionPayload) => Promise<void> | void;
  onOpenAlertCenter: () => void;
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
    accentClass: "bg-success-ghost",
  },
  {
    id: "news",
    label: "Macro / News Agent",
    icon: "public",
    accentClass: "bg-sky-400/8",
  },
  {
    id: "risk",
    label: "Risk Agent",
    icon: "shield",
    accentClass: "bg-rose-500/8",
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
        ? "border-success-subtle shadow-success-hairline"
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
    return "border-success-soft bg-success-strong text-success-strong";
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
  card,
  onAction,
  isPending,
}: {
  card: AIRecommendationActionCard;
  onAction: (payload: AIRecommendationActionPayload) => Promise<void> | void;
  isPending: boolean;
}) {
  const severityClass =
    card.severity === "critical"
      ? "bg-rose-500/14 text-rose-200"
      : card.severity === "warning"
        ? "bg-amber-400/14 text-amber-200"
        : "bg-sky-400/14 text-sky-100";

  return (
    <article className="ui-surface-card relative overflow-hidden rounded-3xl p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/8" />
      <div className="relative">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500">{card.title}</p>
            <p className="mt-3 text-xl font-semibold leading-snug text-white">{card.primary}</p>
            {card.secondary ? <p className="mt-2 text-sm text-slate-400">{card.secondary}</p> : null}
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] ${severityClass}`}>
            <MaterialIcon name={card.icon} outlined={false} className="text-sm" />
            {card.severity}
          </span>
        </div>

        <div className="mb-5 rounded-2xl border border-white/6 bg-white/4 px-3 py-3">
          <p className="text-sm text-slate-300">{card.rationale}</p>
          {card.linkedAlertLabel ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Linked: {card.linkedAlertLabel}</p> : null}
        </div>

        <button
          type="button"
          onClick={() => void onAction(card.payload)}
          disabled={isPending}
          className="ui-button-tonal-danger inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {isPending ? "Applying..." : card.buttonLabel}
        </button>
      </div>
    </article>
  );
}

function EmptyRecommendationHero({ onAnalyze, isDisabled }: { onAnalyze: () => void; isDisabled: boolean }) {
  return (
    <div className="ui-surface-hero relative overflow-hidden rounded-4xl px-5 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">

      <div className="relative flex flex-col gap-8 lg:min-h-76 lg:justify-center lg:pr-72 xl:pr-88">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-3">
            <Image
              src="/AI.png"
              alt="AI"
              width={36}
              height={36}
              priority={false}
              className="h-8 w-8 object-contain sm:h-9 sm:w-9"
            />
            <span
              className="text-[1.75rem] font-extrabold tracking-[0.12em] text-white sm:text-[2.2rem]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              AI recommendation
            </span>
          </div>

          <p className="mt-6 max-w-2xl text-lg font-semibold tracking-[0.12em] text-white sm:text-xl lg:text-[1.7rem]">
            Trade with discipline, act with conviction
          </p>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={isDisabled}
            className="ui-button-hero group relative mt-8 inline-flex min-h-14 items-center gap-3 overflow-hidden rounded-full px-7 text-base font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="pointer-events-none absolute inset-0 rounded-full bg-white/6 opacity-0 transition group-hover:opacity-100" />
            <span className="pointer-events-none absolute inset-px rounded-full border border-white/18" />
            <span className="relative">Analyze with AI</span>
            <MaterialIcon name="arrow_forward" outlined={false} className="relative text-lg transition group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="relative mx-auto flex w-full max-w-[20rem] justify-center lg:absolute lg:-right-4 lg:top-[51%] lg:w-auto lg:max-w-none lg:-translate-y-1/2 lg:justify-end xl:-right-8 xl:top-[53%]">
          <div className="pointer-events-none absolute inset-x-[12%] bottom-2 h-8 rounded-full bg-black/25 blur-xl" />
          <Image
            src="/coin.svg"
            alt="Bitcoin and Ethereum coin illustration"
            width={380}
            height={280}
            priority={false}
            className="relative h-auto w-full max-w-[18rem] drop-shadow-[0_18px_40px_rgba(67,23,156,0.24)] sm:max-w-[20rem] lg:max-w-md xl:max-w-124"
          />
        </div>
      </div>
    </div>
  );
}

export function AIPortfolioRecommendationDashboard({
  recommendation,
  actionCards,
  alerts,
  isAnalyzing,
  activeStepId,
  steps,
  error,
  actionFeedback,
  onClearActionFeedback,
  onAction,
  onOpenAlertCenter,
  onAnalyze,
  isDisabled = false,
}: AIPortfolioRecommendationDashboardProps) {
  const reasoningRef = useRef<HTMLElement | null>(null);
  const [isCouncilProcessing, setCouncilProcessing] = useState(isAnalyzing);
  const [highlightedFactId, setHighlightedFactId] = useState<MarketFactId | null>(null);
  const [openAccordionId, setOpenAccordionId] = useState<AgentAccordion["id"] | null>("technical");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

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
  const showEmptyHero = !recommendation && !isCouncilProcessing;
  const criticalAlertCount = alerts.filter((alert) => alert.status === "active" && alert.severity === "critical").length;
  const topCriticalAlert = alerts.find((alert) => alert.status === "active" && alert.severity === "critical") ?? null;

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

  const handleAction = async (cardId: string, payload: AIRecommendationActionPayload) => {
    setPendingActionId(cardId);
    try {
      await onAction(payload);
    } finally {
      setPendingActionId(null);
    }
  };

  if (showEmptyHero) {
    return (
      <section className="mb-6 lg:mb-8">
        <EmptyRecommendationHero onAnalyze={onAnalyze} isDisabled={isDisabled || isAnalyzing} />

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="ui-surface-deep relative mb-6 overflow-hidden rounded-4xl text-white shadow-[0_30px_90px_rgba(0,0,0,0.42)] lg:mb-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/12" />

      <div className="relative px-5 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col gap-5">
          <header className="ui-surface-panel rounded-[1.6rem] p-5 sm:p-6">
            {showEmptyHero ? (
              <EmptyRecommendationHero onAnalyze={onAnalyze} isDisabled={isDisabled || isAnalyzing} />
            ) : (
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
                  className="ui-button-tonal-info inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <MaterialIcon name={isAnalyzing ? "hourglass_top" : "flash_on"} outlined={false} className="text-lg" />
                  Analyze with AI
                </button>
              </div>
            )}

            {isCouncilProcessing ? (
              <div className="mt-5 rounded-3xl border border-white/8 bg-[#0a0f18] px-4 py-5 sm:px-5">
                <div className="grid gap-4 lg:grid-cols-3">
                  {PROCESSING_AGENTS.map((agent) => (
                    <article
                      key={agent.id}
                      className="ui-surface-card relative overflow-hidden rounded-[1.35rem] p-4"
                    >
                      <div className={`pointer-events-none absolute inset-0 ${agent.accentClass}`} />
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

                <div className="ui-surface-info mx-auto mt-3 flex max-w-sm items-center justify-center gap-3 rounded-full px-5 py-3 text-center">
                  <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300" />
                  <p className="text-sm font-semibold text-sky-100">Synthesizing Final Call...</p>
                </div>

                <p className="mt-4 text-center text-sm text-slate-400">{activeStepLabel}</p>
              </div>
            ) : recommendation ? (
              <div className="ui-surface-danger-soft mt-5 rounded-[1.3rem] px-4 py-4 shadow-[0_0_0_1px_rgba(244,63,94,0.08),0_18px_40px_rgba(0,0,0,0.18)]">
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
                      {criticalAlertCount > 0 ? (
                        <button
                          type="button"
                          onClick={onOpenAlertCenter}
                          className="mt-2 inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-100 transition hover:bg-rose-500/16"
                        >
                          <span className="h-2 w-2 rounded-full bg-rose-300 animate-pulse" />
                          {criticalAlertCount} critical alert{criticalAlertCount > 1 ? "s" : ""}
                        </button>
                      ) : null}
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
            ) : null}

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            {actionFeedback ? (
              <div
                className={`mt-4 flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${
                  actionFeedback.tone === "success"
                    ? "status-badge-success"
                    : actionFeedback.tone === "error"
                      ? "border border-rose-500/20 bg-rose-500/10 text-rose-100"
                      : "border border-sky-400/20 bg-sky-500/10 text-sky-100"
                }`}
              >
                <p>{actionFeedback.message}</p>
                <button type="button" onClick={onClearActionFeedback} className="text-current/80 transition hover:text-current">
                  <MaterialIcon name="close" outlined={false} className="text-lg" />
                </button>
              </div>
            ) : null}
          </header>

          {showDecisionSections ? (
            <>
              {topCriticalAlert ? (
                <section className="ui-surface-danger-soft rounded-[1.6rem] px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-rose-300/80">Critical risk pressure</p>
                      <p className="mt-2 text-lg font-semibold text-white">{topCriticalAlert.title}</p>
                      <p className="mt-1 text-sm text-rose-100/80">{topCriticalAlert.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenAlertCenter}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-50 transition hover:bg-rose-500/16"
                    >
                      Review critical alerts
                    </button>
                  </div>
                </section>
              ) : null}

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
                className="ui-surface-deep grid scroll-mt-6 grid-cols-1 gap-4 rounded-[1.8rem] p-5 lg:grid-cols-[1.15fr_0.85fr] lg:p-6"
              >
                <article className="ui-surface-panel rounded-[1.4rem] p-5">
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

                <article className="ui-surface-panel rounded-[1.4rem] p-4">
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
                                  <p key={bullet} className="rounded-xl border border-white/6 bg-white/4 px-3 py-2">
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

              <section className="ui-surface-panel rounded-[1.8rem] p-5 lg:p-6">
                <div className="mb-5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Decision Support &amp; Future Simulation</p>
                  <h4 className="mt-2 text-2xl font-semibold tracking-tight text-white">Actionable spot-trading simulation</h4>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {actionCards.map((card) => (
                    <ActionCard
                      key={card.id}
                      card={card}
                      onAction={(payload) => handleAction(card.id, payload)}
                      isPending={pendingActionId === card.id}
                    />
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
