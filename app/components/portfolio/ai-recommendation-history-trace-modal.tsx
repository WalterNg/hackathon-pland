"use client";

import { useEffect, useState } from "react";

import { MaterialIcon } from "../dashboard/material-icon";
import type {
  AIAnalysisSentimentText,
  PortfolioAIRecommendationHistoryItem,
} from "@/app/lib/portfolio-types";
import { formatDateTime, shortSessionId } from "./ai-recommendation-history-utils";

type Props = {
  open: boolean;
  onClose: () => void;
  item: PortfolioAIRecommendationHistoryItem | null;
  portfolioName: string;
};

type PhaseDefinition = {
  id: string;
  label: string;
  description: string;
  icon: string;
};

const PHASES: PhaseDefinition[] = [
  { id: "validate_inputs", label: "Validate Inputs", icon: "check_circle", description: "Confirm the request shape and asset list before any model work begins." },
  { id: "prepare_context", label: "Prepare Context", icon: "window", description: "Collect market data, news inputs, and portfolio context for all downstream agents." },
  { id: "technical_analyst", label: "Technical Analyst", icon: "candlestick_chart", description: "Assess trend, momentum, and strongest versus weakest positions." },
  { id: "news_analyst", label: "News Analyst", icon: "language", description: "Review catalysts, headwinds, and how the external narrative affects the portfolio." },
  { id: "sentiment_analyst", label: "Sentiment Analyst", icon: "sentiment_satisfied", description: "Measure crowd mood and whether positioning is helping or hurting the setup." },
  { id: "portfolio_structure_analyst", label: "Portfolio Structure", icon: "pie_chart", description: "Check concentration, cash flexibility, and structural resilience." },
  { id: "bull_researcher", label: "Bull Researcher", icon: "trending_up", description: "Build the positive case for holding or adding risk." },
  { id: "bear_researcher", label: "Bear Researcher", icon: "trending_down", description: "Challenge the thesis and surface downside risk." },
  { id: "investment_manager", label: "Investment Manager", icon: "account_balance", description: "Turn the debate into a portfolio stance." },
  { id: "trader", label: "Trader Proposal", icon: "bolt", description: "Translate the stance into an actionable execution proposal." },
  { id: "aggressive_risk_analyst", label: "Aggressive Risk", icon: "local_fire_department", description: "Argue for preserving upside and tolerating more risk." },
  { id: "conservative_risk_analyst", label: "Conservative Risk", icon: "shield", description: "Argue for capital protection and tighter constraints." },
  { id: "neutral_risk_analyst", label: "Neutral Risk", icon: "balance", description: "Balance the aggressive and conservative positions." },
  { id: "risk_judge", label: "Risk Judge", icon: "gavel", description: "Synthesize risk perspectives into a final risk judgment." },
  { id: "guardrails", label: "Guardrails", icon: "security", description: "Apply non-negotiable safety overrides to the action." },
  { id: "finalize_response", label: "Finalize Response", icon: "task_alt", description: "Assemble the final payload for the UI and persistence layer." },
];

const BEAR_CASE_FALLBACK_MESSAGE = "Bear case unavailable for this run.";
const BEAR_CASE_CONTEXTUAL_MESSAGE =
  "Bear case was unavailable for this run. The system kept the workflow running and applied fallback content.";

type DetailSection = {
  heading: string;
  items: (string | AIAnalysisSentimentText)[];
  isChecklist?: boolean;
  forcedSentiment?: "Bullish" | "Bearish" | "Neutral";
};

type StepDetailContent = {
  title: string;
  subtitle?: string;
  badge?: { label: string; color: string };
  metrics?: { label: string; value: string; color?: string }[];
  sections?: DetailSection[];
  traceDetail?: string;
};

function actionTheme(action: string | undefined) {
  if (action === "Accumulate") {
    return {
      heroBorder: "border-success-strong",
      heroBg: "bg-success-faint",
      actionText: "text-success-soft",
      actionLabel: "text-success-muted",
      badge: "status-badge-success-soft",
    };
  }

  if (action === "Reduce Risk" || action === "Stop Loss") {
    return {
      heroBorder: "border-rose-500/30",
      heroBg: "bg-rose-500/[0.04]",
      actionText: "text-rose-300",
      actionLabel: "text-rose-400/60",
      badge: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    };
  }

  if (action === "Rebalance") {
    return {
      heroBorder: "border-amber-500/30",
      heroBg: "bg-amber-500/[0.04]",
      actionText: "text-amber-300",
      actionLabel: "text-amber-400/60",
      badge: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    };
  }

  return {
    heroBorder: "border-sky-500/25",
    heroBg: "bg-sky-500/[0.04]",
    actionText: "text-sky-200",
    actionLabel: "text-sky-400/60",
    badge: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  };
}

function getSentimentInfo(value: string | AIAnalysisSentimentText) {
  if (typeof value === "object" && value.sentiment) {
    const sentiment = value.sentiment;
    if (sentiment === "Bullish") return { border: "border-success-strong", bg: "bg-success-faint", dot: "bg-success-indicator" };
    if (sentiment === "Bearish") return { border: "border-rose-500/40", bg: "bg-rose-500/5", dot: "bg-rose-400" };
    if (sentiment === "Neutral") return { border: "border-slate-500/20", bg: "bg-transparent", dot: "bg-slate-500" };
  }

  const text = typeof value === "string" ? value.toLowerCase() : value.text.toLowerCase();

  if (
    text.includes("bullish") ||
    text.includes("up") ||
    text.includes("above") ||
    text.includes("healthy") ||
    text.includes("strongest")
  ) {
    return { border: "border-success-strong", bg: "bg-success-faint", dot: "bg-success-indicator" };
  }

  if (
    text.includes("bearish") ||
    text.includes("down") ||
    text.includes("below") ||
    text.includes("weakest") ||
    text.includes("risk-off") ||
    text.includes("headwind")
  ) {
    return { border: "border-rose-500/40", bg: "bg-rose-500/5", dot: "bg-rose-400" };
  }

  if (text.includes("mixed") || text.includes("concentrated") || text.includes("caution") || text.includes("warning")) {
    return { border: "border-amber-500/40", bg: "bg-amber-500/5", dot: "bg-amber-400" };
  }

  return { border: "border-slate-500/20", bg: "bg-transparent", dot: "bg-slate-500" };
}

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value.toFixed(1)}%`;
}

function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return value.toLocaleString("en-US");
}

function buildStepDetail(
  phase: PhaseDefinition,
  item: PortfolioAIRecommendationHistoryItem
): StepDetailContent {
  const recommendation = item.recommendation;
  const evidence = recommendation.evidence;
  const metadata = recommendation.metadata;
  const alerts = metadata?.linkedAlerts ?? [];
  const reasoning = recommendation.reasoning;
  const signals = recommendation.signals;
  const action = recommendation.action;
  const theme = actionTheme(action);

  const base: StepDetailContent = {
    title: phase.label,
    subtitle: phase.description,
    traceDetail: `Record ${shortSessionId(item.id)} · Session ${shortSessionId(item.portfolioUiSessionId)}`,
  };

  switch (phase.id) {
    case "validate_inputs":
      return {
        ...base,
        sections: [
          {
            heading: "Verification Summary",
            items: [
              `Portfolio record loaded for ${item.recommendation.portfolioUiSessionId ? "the active UI session" : "a historical session"}.`,
              `Analyzed at: ${formatDateTime(recommendation.analyzedAt)}`,
              `Snapshot timestamp: ${formatDateTime(recommendation.snapshotTimestamp)}`,
              `Confidence: ${item.confidence}/10`,
            ],
            isChecklist: true,
          },
        ],
      };

    case "prepare_context":
      return {
        ...base,
        sections: [
          {
            heading: "Data Acquisition Output",
            items: [
              `Portfolio value: ${formatCurrency(evidence.portfolioValueUsd)}`,
              `Cash balance: ${formatCurrency(evidence.cashBalanceUsd)}`,
              evidence.topAllocationSymbol
                ? `Top allocation: ${evidence.topAllocationSymbol} · ${formatPercent(evidence.topAllocationPercent)}`
                : "Top allocation: N/A",
              `Cash allocation: ${formatPercent(evidence.cashAllocationPercent)}`,
              `24h volume: ${formatCurrency(evidence.volume24hUsd)}`,
            ],
            isChecklist: true,
          },
        ],
      };

    case "technical_analyst":
      return {
        ...base,
        badge: { label: action, color: theme.badge },
        metrics: [{ label: "Signal Strength", value: `${signals.length > 0 ? signals.length : 0}/10` }],
        sections: [
          {
            heading: "Signals",
            items: signals.length
              ? signals.map((signal) => `${signal.label} · ${signal.tone} — ${signal.summary}`)
              : ["No technical signals were stored for this run."],
          },
          {
            heading: "Key Reasoning",
            items: reasoning.length ? reasoning : ["No reasoning items were attached to this run."],
          },
        ],
      };

    case "news_analyst":
      return {
        ...base,
        sections: [
          {
            heading: "Linked Alerts",
            items: alerts.length
              ? alerts.map((alert) => `${alert.title} · ${alert.severity} · ${alert.status}`)
              : ["No linked alerts were attached to this run."],
          },
          {
            heading: "Market Narrative",
            items: [
              `Action context: ${action}`,
              `Workflow version: ${recommendation.workflowVersion ?? "workflow"}`,
              `Urgency: ${metadata?.urgency ?? "N/A"}`,
            ],
          },
        ],
      };

    case "sentiment_analyst":
      return {
        ...base,
        sections: [
          {
            heading: "Crowd Mood",
            items: reasoning.length
              ? reasoning
                  .filter((entry) => {
                    const text = typeof entry === "string" ? entry.toLowerCase() : entry.text.toLowerCase();
                    return text.includes("sentiment") || text.includes("mood") || text.includes("crowd") || text.includes("position");
                  })
                  .slice(0, 4)
              : [],
          },
          {
            heading: "Sentiment Notes",
            items: signals.length
              ? signals.map((signal) => `${signal.label} · ${signal.tone}`)
              : ["No sentiment-specific notes were stored for this run."],
          },
        ],
      };

    case "portfolio_structure_analyst":
      return {
        ...base,
        metrics: [
          { label: "Portfolio Value", value: formatCurrency(evidence.portfolioValueUsd) },
          { label: "Cash Balance", value: formatCurrency(evidence.cashBalanceUsd) },
          { label: "Risk Score", value: formatCount(evidence.riskScore) },
          { label: "Max Drawdown", value: formatPercent(evidence.maxDrawdownPercent) },
        ],
        sections: [
          {
            heading: "Structure Summary",
            items: [
              `Top allocation: ${evidence.topAllocationSymbol ?? "N/A"}`,
              `Cash allocation: ${formatPercent(evidence.cashAllocationPercent)}`,
              `24h volume: ${formatCurrency(evidence.volume24hUsd)}`,
              `Volatility: ${formatPercent(evidence.volatilityPercent)}`,
            ],
            isChecklist: true,
          },
          {
            heading: "Portfolio Actions",
            items: recommendation.portfolioActions.length
              ? recommendation.portfolioActions
              : ["No portfolio actions were attached to this run."],
          },
        ],
      };

    case "bull_researcher": {
      const bullishItems = reasoning.filter((entry) => {
        const tone = getSentimentInfo(entry);
        return tone.border === "border-success-strong";
      });

      return {
        ...base,
        sections: [
          {
            heading: "Bull Case",
            items: bullishItems.length ? bullishItems : ["No bullish reasoning was attached to this run."],
          },
        ],
      };
    }

    case "bear_researcher": {
      const normalizedBearCase = reasoning
        .map((entry) => (typeof entry === "string" ? entry : entry.text))
        .find((text) => text.toLowerCase().includes("bear") || text.toLowerCase().includes("risk") || text.toLowerCase().includes("down"));

      const shouldUseContextualMessage =
        !normalizedBearCase || normalizedBearCase.trim().length === 0 || normalizedBearCase === BEAR_CASE_FALLBACK_MESSAGE;

      return {
        ...base,
        sections: [
          {
            heading: "Bear Case",
            items: [
              shouldUseContextualMessage
                ? BEAR_CASE_CONTEXTUAL_MESSAGE
                : normalizedBearCase,
            ],
          },
        ],
      };
    }

    case "investment_manager":
      return {
        ...base,
        badge: { label: action, color: theme.badge },
        metrics: [{ label: "Confidence", value: `${item.confidence}/10` }],
        sections: [
          {
            heading: "Manager's Synthesis",
            items: [recommendation.summary],
          },
          {
            heading: "Reasoning",
            items: reasoning.length ? reasoning : ["No decision reasoning was attached to this run."],
          },
        ],
      };

    case "trader":
      return {
        ...base,
        badge: { label: action, color: theme.badge },
        metrics: [{ label: "Confidence", value: `${item.confidence}/10` }],
        sections: [
          {
            heading: "Thesis",
            items: [recommendation.summary],
          },
          {
            heading: "Implementation Steps",
            items: recommendation.portfolioActions.length
              ? recommendation.portfolioActions
              : ["No implementation steps were attached to this run."],
          },
        ],
      };

    case "aggressive_risk_analyst":
      return {
        ...base,
        sections: [
          {
            heading: "Aggressive View",
            items: alerts.length
              ? alerts.map((alert) => `${alert.title} · ${alert.severity}`)
              : ["No aggressive-risk context was attached to this run."],
          },
        ],
      };

    case "conservative_risk_analyst":
      return {
        ...base,
        sections: [
          {
            heading: "Conservative View",
            items: [
              `Risk score: ${formatCount(evidence.riskScore)}`,
              `Max drawdown: ${formatPercent(evidence.maxDrawdownPercent)}`,
              `Volatility: ${formatPercent(evidence.volatilityPercent)}`,
            ],
          },
        ],
      };

    case "neutral_risk_analyst":
      return {
        ...base,
        sections: [
          {
            heading: "Neutral View",
            items: reasoning.length
              ? reasoning.slice(0, 4)
              : ["No neutral-risk context was attached to this run."],
          },
        ],
      };

    case "risk_judge":
      return {
        ...base,
        badge: {
          label: `Risk: ${metadata?.urgency ?? "Unknown"}`,
          color:
            metadata?.urgency === "info"
              ? "status-badge-success-soft"
              : metadata?.urgency === "warning"
              ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
              : "border-rose-400/30 bg-rose-400/10 text-rose-300",
        },
        metrics: [{ label: "Capital Preservation Bias", value: metadata?.urgency ?? "N/A" }],
        sections: [
          {
            heading: "Judge Summary",
            items: [
              `Alerts linked: ${alerts.length}`,
              `Suggested actions: ${metadata?.recommendedActions.length ?? 0}`,
            ],
          },
          {
            heading: "Constraints",
            items: alerts.length
              ? alerts.map((alert) => `${alert.title} · ${alert.status}`)
              : ["No risk constraints were attached to this run."],
          },
        ],
      };

    case "guardrails":
      return {
        ...base,
        sections: [
          {
            heading: "Guardrails",
            items: [
              alerts.length
                ? `Linked alerts: ${alerts.length}`
                : "No linked alerts were attached to this run.",
              metadata?.suggestedRulePatch ? "Suggested rule patch captured." : "No suggested rule patch was captured.",
              metadata?.suggestedTransactionIntent
                ? `${metadata.suggestedTransactionIntent.action.toUpperCase()} ${metadata.suggestedTransactionIntent.symbol}`
                : "No suggested transaction intent was attached.",
            ],
          },
        ],
      };

    case "finalize_response":
    default:
      return {
        ...base,
        badge: { label: action, color: theme.badge },
        metrics: [
          { label: "Confidence", value: `${item.confidence}/10` },
          { label: "Analyzed", value: formatDateTime(recommendation.analyzedAt) },
          { label: "Workflow", value: recommendation.workflowVersion ?? "workflow" },
        ],
        sections: [
          {
            heading: "Summary",
            items: [recommendation.summary],
          },
          {
            heading: "Reasoning",
            items: reasoning.length ? reasoning : ["No final reasoning was attached to this run."],
          },
          {
            heading: "Portfolio Actions",
            items: recommendation.portfolioActions.length
              ? recommendation.portfolioActions
              : ["No portfolio actions were attached to this run."],
          },
        ],
      };
  }
}

function OverviewPanel({ item }: { item: PortfolioAIRecommendationHistoryItem }) {
  const recommendation = item.recommendation;
  const theme = actionTheme(recommendation.action);

  return (
    <div className="space-y-4 animate-[fadeSlideIn_0.2s_ease_both] p-5 sm:p-6">
      <div className={`rounded-2xl border p-5 ${theme.heroBorder} ${theme.heroBg}`}>
        <p className={`text-[0.68rem] font-bold uppercase tracking-[0.22em] ${theme.actionLabel}`}>Recommended Action</p>
        <h3 className={`mt-1.5 text-4xl font-bold tracking-tight ${theme.actionText}`}>{recommendation.action}</h3>
        <p className="mt-3 text-[0.84rem] leading-relaxed text-slate-300">{recommendation.summary}</p>

        <div className="mt-4 flex flex-wrap gap-3 border-t border-white/8 pt-4">
          <div>
            <p className="text-[0.67rem] uppercase tracking-[0.16em] text-slate-500">Confidence</p>
            <p className="mt-0.5 text-sm font-bold text-white">{item.confidence}/10</p>
          </div>
          <div>
            <p className="text-[0.67rem] uppercase tracking-[0.16em] text-slate-500">Analyzed</p>
            <p className="mt-0.5 text-sm font-bold text-white">{formatDateTime(recommendation.analyzedAt)}</p>
          </div>
          <div>
            <p className="text-[0.67rem] uppercase tracking-[0.16em] text-slate-500">Workflow</p>
            <p className="mt-0.5 text-sm font-bold text-white capitalize">{recommendation.workflowVersion ?? "workflow"}</p>
          </div>
        </div>
      </div>

      {recommendation.portfolioActions.length > 0 && (
        <div>
          <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-500">Portfolio Actions</p>
          <div className="space-y-2">
            {recommendation.portfolioActions.map((action) => (
              <div key={action} className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-[#0d1117] px-3.5 py-2.5">
                <MaterialIcon name="chevron_right" outlined={false} className="shrink-0 text-[0.9rem] text-slate-500 mt-0.5" />
                <p className="text-[0.82rem] leading-relaxed text-slate-300">{action}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailSectionView({
  section,
}: {
  section: DetailSection;
}) {
  if (section.items.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-500">{section.heading}</p>
      <div className="space-y-2">
        {section.items.map((item, index) => {
          const tone = section.isChecklist
            ? null
            : section.forcedSentiment
            ? getSentimentInfo({ text: "", sentiment: section.forcedSentiment })
            : getSentimentInfo(item);

          return (
            <div
              key={`${section.heading}-${index}`}
              className={`relative overflow-hidden flex items-center gap-2.5 rounded-xl border border-white/8 bg-[#0d1117] px-3.5 py-2.5 text-[0.83rem] leading-relaxed text-slate-300 ${tone?.bg || ""}`}
            >
              {!section.isChecklist && tone && <div className={`absolute left-0 top-0 bottom-0 w-0.75 ${tone.dot} opacity-70`} />}
              {section.isChecklist && <MaterialIcon name="check_circle" outlined={false} className="text-success-dim flex h-5 w-5 shrink-0 items-center justify-center text-[0.9rem] leading-none" />}
              <span className="flex-1 whitespace-pre-wrap">{typeof item === "string" ? item : item.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepDetailPanel({
  phase,
  item,
}: {
  phase: PhaseDefinition;
  item: PortfolioAIRecommendationHistoryItem;
}) {
  const content = buildStepDetail(phase, item);

  return (
    <div className="space-y-5 p-5 sm:p-6 animate-[fadeSlideIn_0.2s_ease_both]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/4">
          <MaterialIcon name={phase.icon} outlined={true} className="flex items-center justify-center text-[1.1rem] leading-none text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{content.title}</h3>
            {content.badge && (
              <span className={`rounded-full border px-2.5 py-0.5 text-[0.72rem] font-bold uppercase tracking-[0.14em] ${content.badge.color}`}>
                {content.badge.label}
              </span>
            )}
          </div>
          {content.subtitle && <p className="mt-0.5 text-[0.8rem] text-slate-500 leading-snug">{content.subtitle}</p>}
        </div>
      </div>

      {content.traceDetail && (
        <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/2 px-3 py-2.5">
          <MaterialIcon name="terminal" outlined={false} className="shrink-0 text-[0.85rem] text-slate-500" />
          <span className="text-[0.78rem] text-slate-400 font-mono">{content.traceDetail}</span>
        </div>
      )}

      {content.metrics && content.metrics.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {content.metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-center">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
              <p className={`mt-1 text-lg font-bold ${metric.color ?? "text-white"}`}>{metric.value}</p>
            </div>
          ))}
        </div>
      )}

      {content.sections && content.sections.map((section) => <DetailSectionView key={section.heading} section={section} />)}

      {(!content.sections || content.sections.length === 0) && (
        <p className="text-sm text-slate-500">No data available for this step yet.</p>
      )}
    </div>
  );
}

function Sidebar({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const completedCount = PHASES.length;
  const headerLabel = `All ${completedCount} steps completed`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-white/8 px-4 py-3">
        <p className="text-[0.78rem] font-semibold text-slate-300">{headerLabel}</p>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-white/4">
        <li>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={[
              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150",
              selectedId === null ? "bg-white/6 border-l-2 border-l-sky-400" : "hover:bg-white/4",
            ].join(" ")}
          >
            <MaterialIcon name="summarize" outlined={true} className="shrink-0 text-[1rem] text-sky-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.83rem] font-semibold text-sky-200">Final Decision</p>
              <p className="mt-0.5 truncate text-[0.71rem] text-slate-600">Overall recommendation &amp; reasoning</p>
            </div>
          </button>
        </li>

        {PHASES.map((phase) => {
          const isSelected = selectedId === phase.id;
          const isDone = true;

          return (
            <li key={phase.id}>
              <button
                type="button"
                onClick={() => onSelect(phase.id)}
                className={[
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150",
                  isSelected ? "bg-white/6 border-l-2 border-l-sky-400" : isDone ? "bg-white/[0.015] hover:bg-white/4" : "hover:bg-white/4",
                ].join(" ")}
              >
                <div className="shrink-0">
                  {isDone ? (
                    <MaterialIcon name="check_circle" outlined={false} className="text-success-dim text-[1rem]" />
                  ) : (
                    <MaterialIcon name={phase.icon} outlined={true} className="text-[1rem] text-slate-600" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className={[
                    "truncate text-[0.83rem] font-medium leading-snug",
                    isSelected ? "text-sky-200" : isDone ? "text-slate-300" : "text-slate-500",
                  ].join(" ")}>
                    {phase.label}
                  </p>
                  <p className="mt-0.5 truncate text-[0.71rem] text-slate-600 leading-snug">
                    {phase.description}
                  </p>
                </div>

                {isSelected && <MaterialIcon name="chevron_right" outlined={false} className="shrink-0 text-[0.9rem] text-slate-500" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AiRecommendationHistoryTraceModal({ open, onClose, item, portfolioName }: Props) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedPhaseId(null);
    }
  }, [open, item?.id]);

  if (!open || !item) {
    return null;
  }

  const recommendation = item.recommendation;
  const theme = actionTheme(recommendation.action);
  const selectedPhase = PHASES.find((phase) => phase.id === selectedPhaseId) ?? null;

  return (
    <div className="modal-backdrop z-95 items-start overflow-y-auto py-6">
      <div className="modal-shell my-auto flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-[#0b0f14] p-0 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className={`border-b px-5 py-4 sm:px-6 ${theme.heroBorder} ${theme.heroBg}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-slate-500">Multi-Agent Analysis Trace</p>
              <h2 className="mt-1.5 text-xl font-bold tracking-tight text-white">{portfolioName}</h2>
              <p className={`mt-0.5 text-[0.82rem] ${theme.actionText}`}>Completed on {formatDateTime(recommendation.analyzedAt)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-[0.72rem] font-bold uppercase tracking-[0.18em] ${theme.badge}`}>
                Completed
              </span>
              <button
                type="button"
                onClick={onClose}
                className="icon-button h-9 w-9 rounded-xl border border-white/8 bg-white/4 text-slate-400 hover:text-white"
                aria-label="Close trace modal"
              >
                <MaterialIcon name="close" outlined={false} className="text-lg" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-white/10 bg-[#0d1117]">
            <Sidebar selectedId={selectedPhaseId} onSelect={setSelectedPhaseId} />
          </aside>

          <div className="min-h-0 overflow-y-auto bg-[#0b0f14]">
            {selectedPhase ? <StepDetailPanel phase={selectedPhase} item={item} /> : <OverviewPanel item={item} />}
          </div>
        </div>
      </div>
    </div>
  );
}
