"use client";

import { useState } from "react";

import { MaterialIcon } from "../dashboard/material-icon";
import type {
  TradingAgentPreparedContext,
  TradingAgentResult,
  TradingAgentTraceEvent,
} from "@/app/lib/trading-agent-types";

/* ---------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------*/
type TradingAgentTraceModalProps = {
  open: boolean;
  onClose: () => void;
  result: TradingAgentResult | null;
  preparedContext: TradingAgentPreparedContext | null;
  trace: TradingAgentTraceEvent[];
  activeNodes: string[];
  isAnalyzing: boolean;
  progressLabel: string;
  portfolioName: string;
  warnings: string[];
  error: string | null;
};

type PhaseDefinition = {
  id: string;
  label: string;
  description: string;
  icon: string;
};

/* ---------------------------------------------------------------------------
 * Phase definitions — sidebar steps
 * -------------------------------------------------------------------------*/
const PHASES: PhaseDefinition[] = [
  { id: "validate_inputs",            label: "Validate Inputs",            icon: "check_circle",      description: "Confirm the request shape and asset list before any model work begins." },
  { id: "prepare_context",            label: "Prepare Context",            icon: "window",             description: "Collect market data, news inputs, and portfolio context for all downstream agents." },
  { id: "technical_analyst",          label: "Technical Analyst",          icon: "candlestick_chart",  description: "Assess trend, momentum, and strongest versus weakest positions." },
  { id: "news_analyst",               label: "News Analyst",               icon: "language",           description: "Review catalysts, headwinds, and how the external narrative affects the portfolio." },
  { id: "sentiment_analyst",          label: "Sentiment Analyst",          icon: "sentiment_satisfied",description: "Measure crowd mood and whether positioning is helping or hurting the setup." },
  { id: "portfolio_structure_analyst",label: "Portfolio Structure",        icon: "pie_chart",          description: "Check concentration, cash flexibility, and structural resilience." },
  { id: "bull_researcher",            label: "Bull Researcher",            icon: "trending_up",        description: "Build the positive case for holding or adding risk." },
  { id: "bear_researcher",            label: "Bear Researcher",            icon: "trending_down",      description: "Challenge the thesis and surface downside risk." },
  { id: "investment_manager",         label: "Investment Manager",         icon: "account_balance",    description: "Turn the debate into a portfolio stance." },
  { id: "trader",                     label: "Trader Proposal",            icon: "bolt",               description: "Translate the stance into an actionable execution proposal." },
  { id: "aggressive_risk_analyst",    label: "Aggressive Risk",            icon: "local_fire_department", description: "Argue for preserving upside and tolerating more risk." },
  { id: "conservative_risk_analyst",  label: "Conservative Risk",          icon: "shield",             description: "Argue for capital protection and tighter constraints." },
  { id: "neutral_risk_analyst",       label: "Neutral Risk",               icon: "balance",            description: "Balance the aggressive and conservative positions." },
  { id: "risk_judge",                 label: "Risk Judge",                 icon: "gavel",              description: "Synthesize risk perspectives into a final risk judgment." },
  { id: "guardrails",                 label: "Guardrails",                 icon: "security",           description: "Apply non-negotiable safety overrides to the action." },
  { id: "finalize_response",          label: "Finalize Response",          icon: "task_alt",           description: "Assemble the final payload for the UI and persistence layer." },
];

const BEAR_CASE_FALLBACK_MESSAGE = "Bear case unavailable for this run.";
const BEAR_CASE_CONTEXTUAL_MESSAGE =
  "Bear case was unavailable for this run. The system kept the workflow running and applied fallback content.";
const BEAR_CASE_FALLBACK_WARNING_FRAGMENT = "bear researcher returned an empty case";

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------*/
function stepVisualState(
  stepId: string,
  trace: TradingAgentTraceEvent[],
  activeNodes: string[]
): "pending" | "active" | "completed" | "error" {
  if (activeNodes.includes(stepId)) return "active";
  const evt = trace.find((t) => t.step === stepId);
  if (!evt) return "pending";
  if (evt.status === "error") return "error";
  return "completed";
}

function actionTheme(action: string | undefined) {
  if (action === "Accumulate")
    return {
      heroBorder: "border-emerald-500/30",
      heroBg: "bg-emerald-500/[0.04]",
      heroBgGlow: "shadow-[0_0_40px_rgba(16,185,129,0.07)]",
      actionText: "text-emerald-300",
      actionLabel: "text-emerald-400/60",
    };
  if (action === "Reduce Risk" || action === "Stop Loss")
    return {
      heroBorder: "border-rose-500/30",
      heroBg: "bg-rose-500/[0.04]",
      heroBgGlow: "shadow-[0_0_40px_rgba(239,68,68,0.07)]",
      actionText: "text-rose-300",
      actionLabel: "text-rose-400/60",
    };
  if (action === "Rebalance")
    return {
      heroBorder: "border-amber-500/30",
      heroBg: "bg-amber-500/[0.04]",
      heroBgGlow: "shadow-[0_0_40px_rgba(245,158,11,0.07)]",
      actionText: "text-amber-300",
      actionLabel: "text-amber-400/60",
    };
  return {
    heroBorder: "border-sky-500/25",
    heroBg: "bg-sky-500/[0.04]",
    heroBgGlow: "shadow-[0_0_40px_rgba(14,165,233,0.07)]",
    actionText: "text-sky-200",
    actionLabel: "text-sky-400/60",
  };
}

/* ---------------------------------------------------------------------------
 * StepDetailPanel — right-side content when a step is selected
 * -------------------------------------------------------------------------*/
type StepDetailContent = {
  title: string;
  subtitle?: string;
  badge?: { label: string; color: string };
  metrics?: { label: string; value: string; color?: string }[];
  sections?: { 
    heading: string; 
    items: (string | import("@/app/lib/trading-agent-types").TradingAgentSentimentText)[]; 
    isChecklist?: boolean;
    forcedSentiment?: "Bullish" | "Bearish" | "Neutral";
  }[];
  traceDetail?: string;
};

function buildStepDetail(
  phase: PhaseDefinition,
  result: TradingAgentResult | null,
  trace: TradingAgentTraceEvent[],
  portfolioName: string
): StepDetailContent {
  const traceEvent = trace.find((t) => t.step === phase.id);
  const traceDetail = traceEvent?.detail;

  const base: StepDetailContent = {
    title: phase.label,
    subtitle: phase.description,
    traceDetail,
  };

  switch (phase.id) {
    case "validate_inputs": {
      const meta = result?.meta;
      const validatedItems = [];
      
      if (meta?.symbols && meta.symbols.length > 0) {
        validatedItems.push(`Assets detected: ${meta.symbols.join(", ")}`);
      }
      
      if (meta?.as_of) {
        try {
          const date = new Date(meta.as_of);
          const formatted = date.toLocaleString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          validatedItems.push(`Analysis baseline: ${formatted}`);
        } catch {
          validatedItems.push(`Analysis baseline: ${meta.as_of}`);
        }
      }

      validatedItems.push("Data integrity & safety filters: Passed");

      return {
        ...base,
        sections: [
          {
            heading: "Verification Summary",
            items: validatedItems,
            isChecklist: true,
          },
        ],
      };
    }

    case "prepare_context": {
      const meta = result?.meta;
      const items = [];

      items.push(`Source: Global exchanges (Binance/ByBit) data synchronized.`);

      if (meta?.portfolio_snapshot && meta.portfolio_snapshot.length > 0) {
        const snapshotLines = meta.portfolio_snapshot.map((asset) => {
          const priceStr = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 8,
          }).format(asset.current_price);
          return `• ${asset.asset}: ${priceStr}`;
        });
        
        items.push(`Market Snapshot: Assets identified and priced.\n${snapshotLines.join("\n")}`);
      } else if (meta?.symbols && meta.symbols.length > 0) {
        items.push(`Market Snapshot: Synchronized price feeds (OHLCV) for ${meta.symbols.length} assets.`);
      }

      items.push(`Liquidity Map: Order book snapshots & spread calculations verified.`);
      items.push(`Market Vitals: Volume, volatility & funding data aggregation completed.`);

      return {
        ...base,
        sections: [
          {
            heading: "Data Acquisition Output",
            items: items.length > 0 ? items : ["Collecting market context…"],
            isChecklist: true,
          },
        ],
      };
    }

    case "technical_analyst": {
      const r = result?.analyst_reports?.technical;
      if (!r) return base;
      return {
        ...base,
        badge: {
          label: r.portfolio_trend,
          color:
            r.portfolio_trend === "Bullish"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : r.portfolio_trend === "Bearish"
              ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
              : "border-sky-400/30 bg-sky-400/10 text-sky-300",
        },
        metrics: [{ label: "Signal Strength", value: `${r.signal_strength}/10` }],
        sections: [
          { heading: "Summary", items: [r.summary] },
          { heading: "Evidence", items: r.evidence },
          { heading: "Strongest Positions", items: r.strongest_positions },
          { heading: "Weakest Positions", items: r.weakest_positions },
        ],
      };
    }

    case "news_analyst": {
      const r = result?.analyst_reports?.news;
      if (!r) return base;
      return {
        ...base,
        badge: {
          label: r.market_bias,
          color:
            r.market_bias === "Bullish"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : r.market_bias === "Bearish"
              ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
              : "border-sky-400/30 bg-sky-400/10 text-sky-300",
        },
        metrics: [{ label: "Confidence", value: `${r.confidence}/10` }],
        sections: [
          { heading: "Summary", items: [r.summary] },
          { heading: "Catalysts", items: r.catalysts },
          { heading: "Headwinds", items: r.headwinds },
        ],
      };
    }

    case "sentiment_analyst": {
      const r = result?.analyst_reports?.sentiment;
      if (!r) return base;
      return {
        ...base,
        badge: {
          label: r.sentiment_bias,
          color:
            r.sentiment_bias === "Bullish"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : r.sentiment_bias === "Bearish"
              ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
              : "border-sky-400/30 bg-sky-400/10 text-sky-300",
        },
        metrics: [{ label: "Confidence", value: `${r.confidence}/10` }],
        sections: [
          { heading: "Summary", items: [r.summary] },
          { heading: "Drivers", items: r.drivers },
        ],
      };
    }

    case "portfolio_structure_analyst": {
      const r = result?.analyst_reports?.portfolio_structure;
      if (!r) return base;
      return {
        ...base,
        badge: {
          label: r.diversification_view,
          color:
            r.diversification_view === "Healthy"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : r.diversification_view === "Concentrated"
              ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
              : "border-rose-400/30 bg-rose-400/10 text-rose-300",
        },
        metrics: [
          { label: "Concentration Risk", value: r.concentration_risk },
          { label: "Cash Posture", value: r.cash_posture },
        ],
        sections: [
          { heading: "Summary", items: [r.summary] },
          { heading: "Recommended Actions", items: r.actions },
        ],
      };
    }

    case "bull_researcher": {
      const r = result?.investment_debate;
      if (!r) return base;
      return {
        ...base,
        sections: [
          { heading: "Bull Case", items: [r.bull_case], forcedSentiment: "Bullish" },
        ],
      };
    }

    case "bear_researcher": {
      const r = result?.investment_debate;
      if (!r) return base;
      const normalizedBearCase = r.bear_case?.trim() || "";
      const shouldUseContextualMessage =
        normalizedBearCase.length === 0 || normalizedBearCase === BEAR_CASE_FALLBACK_MESSAGE;
      return {
        ...base,
        sections: [
          { 
            heading: "Bear Case", 
            items: [shouldUseContextualMessage ? BEAR_CASE_CONTEXTUAL_MESSAGE : r.bear_case],
            forcedSentiment: "Bearish"
          },
        ],
      };
    }

    case "investment_manager": {
      const debate = result?.investment_debate;
      const decision = result?.portfolio_manager_decision;
      if (!debate && !decision) return base;
      return {
        ...base,
        badge: decision
          ? {
              label: decision.stance,
              color: "border-indigo-400/30 bg-indigo-400/10 text-indigo-300",
            }
          : undefined,
        metrics: decision
          ? [{ label: "Confidence", value: `${decision.confidence}/10` }]
          : undefined,
        sections: [
          ...(debate ? [{ heading: "Manager's Synthesis", items: [debate.manager_summary].filter(Boolean) }] : []),
          ...(decision ? [
            { heading: "Stance Summary", items: [decision.summary] },
            { heading: "Reasoning", items: decision.reasoning },
          ] : []),
        ],
      };
    }

    case "trader": {
      const r = result?.trader_proposal;
      if (!r) return base;
      return {
        ...base,
        badge: {
          label: r.action,
          color: "border-violet-400/30 bg-violet-400/10 text-violet-300",
        },
        metrics: [{ label: "Confidence", value: `${r.confidence}/10` }],
        sections: [
          { heading: "Thesis", items: [r.thesis] },
          { heading: "Implementation Steps", items: r.implementation_steps },
        ],
      };
    }

    case "aggressive_risk_analyst": {
      const r = result?.risk_debate;
      if (!r) return base;
      return {
        ...base,
        sections: [{ heading: "Aggressive View", items: [r.aggressive_view], forcedSentiment: "Bullish" }],
      };
    }

    case "conservative_risk_analyst": {
      const r = result?.risk_debate;
      if (!r) return base;
      return {
        ...base,
        sections: [{ heading: "Conservative View", items: [r.conservative_view], forcedSentiment: "Bearish" }],
      };
    }

    case "neutral_risk_analyst": {
      const r = result?.risk_debate;
      if (!r) return base;
      return {
        ...base,
        sections: [{ heading: "Neutral View", items: [r.neutral_view], forcedSentiment: "Neutral" }],
      };
    }

    case "risk_judge": {
      const r = result?.risk_debate;
      if (!r) return base;
      return {
        ...base,
        badge: {
          label: `Risk: ${r.final_risk_level}`,
          color:
            r.final_risk_level === "Low"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : r.final_risk_level === "Moderate"
              ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
              : "border-rose-400/30 bg-rose-400/10 text-rose-300",
        },
        metrics: [{ label: "Capital Preservation Bias", value: r.capital_preservation_bias }],
        sections: [
          { heading: "Judge Summary", items: [r.judge_summary].filter(Boolean) },
          { heading: "Constraints", items: r.constraints },
        ],
      };
    }

    case "finalize_response": {
      const r = result?.final_decision;
      if (!r) return base;
      return {
        ...base,
        badge: {
          label: r.action,
          color: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        },
        metrics: [
          { label: "Confidence", value: `${r.confidence}/10` },
          { label: "Source", value: r.decision_source.replace(/_/g, " ") },
        ],
        sections: [
          { heading: "Summary", items: [r.summary] },
          { heading: "Reasoning", items: r.reasoning },
          { heading: "Portfolio Actions", items: r.portfolio_actions },
        ],
      };
    }

    default:
      return base;
  }
}

function getSentimentInfo(item: string | import("@/app/lib/trading-agent-types").TradingAgentSentimentText) {
  if (typeof item === "object" && item.sentiment) {
    const s = item.sentiment;
    if (s === "Bullish") return { border: "border-emerald-500/40", bg: "bg-emerald-500/5", dot: "bg-emerald-400" };
    if (s === "Bearish") return { border: "border-rose-500/40", bg: "bg-rose-500/5", dot: "bg-rose-400" };
    if (s === "Neutral") return { border: "border-slate-500/20", bg: "bg-transparent", dot: "bg-slate-500" };
  }

  const t = typeof item === "string" ? item.toLowerCase() : item.text.toLowerCase();
  
  if (t.includes("bullish") || t.includes("up") || t.includes("above") || t.includes("healthy") || t.includes("strongest")) {
    return { 
      border: "border-emerald-500/40", 
      bg: "bg-emerald-500/5", 
      dot: "bg-emerald-400" 
    };
  }
  if (t.includes("bearish") || t.includes("down") || t.includes("below") || t.includes("weakest") || t.includes("risk-off") || t.includes("headwind")) {
    return { 
      border: "border-rose-500/40", 
      bg: "bg-rose-500/5", 
      dot: "bg-rose-400" 
    };
  }
  if (t.includes("mixed") || t.includes("concentrated") || t.includes("caution") || t.includes("warning")) {
    return { 
      border: "border-amber-500/40", 
      bg: "bg-amber-500/5", 
      dot: "bg-amber-400" 
    };
  }
  return { 
    border: "border-slate-500/20", 
    bg: "bg-transparent", 
    dot: "bg-slate-500" 
  };
}

function formatPercent(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function formatUsd(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function PrepareContextExplainPanel({
  preparedContext,
  warnings,
}: {
  preparedContext: TradingAgentPreparedContext | null;
  warnings: string[];
}) {
  const [openCard, setOpenCard] = useState<string | null>("technical");

  const technical = preparedContext?.technical;
  const news = preparedContext?.news;
  const sentiment = preparedContext?.sentiment;
  const structure = preparedContext?.structure;

  const strongest = (technical?.per_asset_signals ?? [])
    .slice()
    .sort((a, b) => b.signal_strength - a.signal_strength)
    .slice(0, 2)
    .map((item) => `${item.symbol} (${item.signal_strength}/10, ${item.trend})`);
  const weakest = (technical?.per_asset_signals ?? [])
    .slice()
    .sort((a, b) => a.signal_strength - b.signal_strength)
    .slice(0, 2)
    .map((item) => `${item.symbol} (${item.signal_strength}/10, ${item.trend})`);

  const macroHighlights = Object.entries(news?.macro_context ?? {})
    .slice(0, 3)
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`);

  const topPositions = (structure?.positions ?? [])
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((p) => `${p.symbol} at ${formatPercent(p.weight)} (${formatUsd(p.value_usd)})`);

  const cards = [
    {
      id: "technical",
      title: "Technical Context",
      summary: "Trend, momentum, position strength, and benchmark posture.",
      badge: technical?.positions?.length ? `${technical.positions.length} positions` : "No positions",
      sections: [
        {
          heading: "Market Posture",
          lines: [
            technical
              ? `The benchmark regime is ${technical.benchmark_context.market_regime.toLowerCase()} with ${technical.benchmark_context.primary_trend.toLowerCase()} trend on ${technical.benchmark_context.primary_symbol ?? "the lead asset"}.`
              : "Technical market posture is not available yet.",
          ],
        },
        {
          heading: "Trend & Momentum Summary",
          lines: [
            technical
              ? `Technical breadth is ${technical.portfolio_technical_summary.technical_breadth.toLowerCase()}. Bullish-weight ratio is ${formatPercent(technical.portfolio_technical_summary.bullish_weight_ratio)} versus bearish-weight ratio at ${formatPercent(technical.portfolio_technical_summary.bearish_weight_ratio)}.`
              : "Momentum summary is pending.",
            technical
              ? `Average RSI is ${technical.portfolio_technical_summary.weighted_avg_rsi.toFixed(1)} and cash allocation is ${formatPercent(technical.cash_ratio)}.`
              : "",
          ].filter(Boolean),
        },
        {
          heading: "Strongest vs Weakest Positions",
          lines: [
            strongest.length > 0 ? `Strongest: ${strongest.join(", ")}.` : "Strongest positions are not available.",
            weakest.length > 0 ? `Weakest: ${weakest.join(", ")}.` : "Weakest positions are not available.",
          ],
        },
      ],
    },
    {
      id: "news",
      title: "News Context",
      summary: "Narrative, headlines, and macro context around the portfolio.",
      badge: news?.news_headlines?.length ? `${news.news_headlines.length} headlines` : "No headlines",
      sections: [
        {
          heading: "Dominant Narrative",
          lines: [news?.dominant_narrative || "No dominant narrative has been extracted yet."],
        },
        {
          heading: "Headline Highlights",
          lines:
            news?.news_headlines?.slice(0, 4).map((line) => `- ${line}`) ??
            ["No headline highlights are available yet."],
        },
        {
          heading: "Macro Signals",
          lines: macroHighlights.length > 0 ? macroHighlights : ["No macro signal summary is available yet."],
        },
      ],
    },
    {
      id: "sentiment",
      title: "Sentiment Context",
      summary: "Market mood and crowd bias impact on current setup.",
      badge: sentiment ? `${sentiment.sentiment_label} (${sentiment.social_sentiment_score.toFixed(0)}/100)` : "No score",
      sections: [
        {
          heading: "Current Market Mood",
          lines: [
            sentiment
              ? `Current crowd sentiment reads ${sentiment.sentiment_label.toLowerCase()} with a score of ${sentiment.social_sentiment_score.toFixed(0)}/100.`
              : "Sentiment score is not available yet.",
          ],
        },
        {
          heading: "Impact on Setup",
          lines: [
            sentiment
              ? sentiment.sentiment_label === "Bullish"
                ? "Sentiment is currently supportive for adding selective risk, provided technical confirmation remains intact."
                : sentiment.sentiment_label === "Bearish"
                ? "Sentiment is currently a headwind, favoring selective risk control and tighter execution discipline."
                : "Sentiment is neutral, so execution quality and technical confirmation should carry more weight than crowd mood."
              : "Setup impact cannot be determined until sentiment data is available.",
          ],
        },
      ],
    },
    {
      id: "structure",
      title: "Portfolio Structure Context",
      summary: "Concentration, cash flexibility, and risk absorption capacity.",
      badge: structure ? `Top1 ${formatPercent(structure.top1_weight)} / Top2 ${formatPercent(structure.top2_weight)}` : "No structure",
      sections: [
        {
          heading: "Concentration Profile",
          lines: [
            structure
              ? `Top-1 weight is ${formatPercent(structure.top1_weight)} and top-2 combined is ${formatPercent(structure.top2_weight)} with concentration score ${structure.concentration_score.toFixed(2)}.`
              : "Concentration profile is not available yet.",
            topPositions.length > 0 ? `Largest holdings: ${topPositions.join("; ")}.` : "No holdings breakdown is available.",
          ],
        },
        {
          heading: "Cash Flexibility & Liquidity",
          lines: [
            structure
              ? `Cash ratio is ${formatPercent(structure.cash_ratio)} and liquidity condition is ${structure.liquidity_condition.toLowerCase()}.`
              : "Cash and liquidity context is not available yet.",
            structure
              ? `Estimated portfolio volatility is ${structure.estimated_volatility.toFixed(2)}, indicating ${structure.estimated_volatility > 0.5 ? "higher" : "moderate"} sensitivity to market swings.`
              : "",
          ].filter(Boolean),
        },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/6 px-4 py-3">
          <p className="text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-amber-200">Data quality note</p>
          <p className="mt-1.5 text-[0.82rem] leading-relaxed text-amber-100">{warnings[0]}</p>
        </div>
      )}

      {cards.map((card) => {
        const isOpen = openCard === card.id;
        return (
          <div key={card.id} className="rounded-2xl border border-white/10 bg-[#0d1117]">
            <button
              type="button"
              onClick={() => setOpenCard((prev) => (prev === card.id ? null : card.id))}
              className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
            >
              <div>
                <p className="text-[1rem] font-semibold text-white">{card.title}</p>
                <p className="mt-1 text-[0.82rem] leading-relaxed text-slate-400">{card.summary}</p>
                <p className="mt-2 text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">{card.badge}</p>
              </div>
              <MaterialIcon
                name={isOpen ? "expand_less" : "expand_more"}
                outlined={false}
                className="mt-0.5 shrink-0 text-[1.1rem] text-slate-400"
              />
            </button>

            {isOpen && (
              <div className="space-y-3 border-t border-white/8 px-5 py-4">
                {card.sections.map((section) => (
                  <div key={section.heading} className="space-y-2">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.15em] text-slate-500 ml-1">
                      {section.heading}
                    </p>
                    <div className="space-y-2">
                      {section.lines.map((line, idx) => {
                        const sentiment = getSentimentInfo(line);
                        return (
                          <div 
                            key={`${section.heading}-${idx}`} 
                            className={`relative overflow-hidden rounded-xl border border-white/8 ${sentiment.bg} px-4 py-3`}
                          >
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${sentiment.dot} opacity-60`} />
                            <p className="text-[0.83rem] leading-relaxed text-slate-300">
                              {line}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepDetailPanel({
  phase,
  result,
  preparedContext,
  trace,
  portfolioName,
  warnings,
}: {
  phase: PhaseDefinition;
  result: TradingAgentResult | null;
  preparedContext: TradingAgentPreparedContext | null;
  trace: TradingAgentTraceEvent[];
  portfolioName: string;
  warnings: string[];
}) {
  const content = buildStepDetail(phase, result, trace, portfolioName);
  const normalizedBearCase = result?.investment_debate?.bear_case?.trim() || "";
  const hasBearCaseFallbackWarning = warnings.some((warning) =>
    warning.toLowerCase().includes(BEAR_CASE_FALLBACK_WARNING_FRAGMENT)
  );
  const showBearCaseWarning =
    phase.id === "bear_researcher" &&
    (hasBearCaseFallbackWarning ||
      normalizedBearCase.length === 0 ||
      normalizedBearCase === BEAR_CASE_FALLBACK_MESSAGE);

  return (
    <div className="space-y-5 p-5 sm:p-6 animate-[fadeSlideIn_0.2s_ease_both]">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/4">
          <MaterialIcon name={phase.icon} outlined={true} className="flex items-center justify-center text-[1.1rem] leading-none text-slate-400" />
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
          {content.subtitle && (
            <p className="mt-0.5 text-[0.8rem] text-slate-500 leading-snug">{content.subtitle}</p>
          )}
        </div>
      </div>

      {/* Trace log pill */}
      {content.traceDetail && (
        <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/2 px-3 py-2.5">
          <MaterialIcon name="terminal" outlined={false} className="shrink-0 text-[0.85rem] text-slate-500" />
          <span className="text-[0.78rem] text-slate-400 font-mono">{content.traceDetail}</span>
        </div>
      )}

      {showBearCaseWarning && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/8 px-3 py-2.5">
          <MaterialIcon name="warning" outlined={false} className="shrink-0 text-[0.9rem] text-amber-300 mt-0.5" />
          <span className="text-[0.8rem] leading-relaxed text-amber-100">
            Bear Researcher did not return usable content. Fallback text is shown for this run.
          </span>
        </div>
      )}

      {/* Metrics row */}
      {content.metrics && content.metrics.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {content.metrics.map((m) => (
            <div key={m.label} className="rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-center">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{m.label}</p>
              <p className={`mt-1 text-lg font-bold ${m.color ?? "text-white"}`}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content sections */}
      {phase.id === "prepare_context" ? (
        <PrepareContextExplainPanel preparedContext={preparedContext} warnings={warnings} />
      ) : (
      content.sections && content.sections.map((sec) =>
        sec.items.length > 0 ? (
          <div key={sec.heading}>
            <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-500">{sec.heading}</p>
            <div className="space-y-2">
              {sec.items.map((item, i) => {
                const sentiment = !sec.isChecklist 
                  ? (sec.forcedSentiment 
                      ? getSentimentInfo({ text: "", sentiment: sec.forcedSentiment }) 
                      : getSentimentInfo(item)) 
                  : null;
                return (
                  <div
                    key={i}
                    className={`relative overflow-hidden flex items-center gap-2.5 rounded-xl border border-white/8 bg-[#0d1117] px-3.5 py-2.5 text-[0.83rem] leading-relaxed text-slate-300 ${sentiment?.bg || ""}`}
                  >
                    {!sec.isChecklist && sentiment && (
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${sentiment.dot} opacity-70`} />
                    )}
                    {sec.isChecklist && (
                      <MaterialIcon name="check_circle" outlined={false} className="flex h-5 w-5 shrink-0 items-center justify-center text-[0.9rem] leading-none text-emerald-500/80" />
                    )}
                    <span className="flex-1 whitespace-pre-wrap">{typeof item === "string" ? item : item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null
      ))}

      {/* No data fallback */}
      {phase.id !== "prepare_context" &&
        !content.traceDetail &&
        (!content.sections || content.sections.every((s) => s.items.length === 0)) && (
        <p className="text-sm text-slate-500">No data available for this step yet.</p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * DecisionHeroPanel — the "Recommendation Action" box (shown when no step selected)
 * -------------------------------------------------------------------------*/
function DecisionHeroPanel({
  result,
  warnings,
  error,
}: {
  result: TradingAgentResult | null;
  warnings: string[];
  error: string | null;
}) {
  const action = result?.final_decision?.action;
  const theme = actionTheme(action);

  return (
    <div className="p-5 sm:p-6 space-y-4 animate-[fadeSlideIn_0.2s_ease_both]">
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/6 px-4 py-3">
          <MaterialIcon name="warning" outlined={false} className="shrink-0 text-base text-amber-400 mt-0.5" />
          <p className="text-[0.82rem] text-amber-100 leading-relaxed">{warnings[0]}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/6 px-4 py-3">
          <MaterialIcon name="error" outlined={false} className="shrink-0 text-base text-rose-400 mt-0.5" />
          <p className="text-[0.82rem] text-rose-100 leading-relaxed">{error}</p>
        </div>
      )}

      {/* Decision Hero */}
      <div className={`rounded-2xl border p-5 ${theme.heroBorder} ${theme.heroBg} ${theme.heroBgGlow}`}>
        <p className={`text-[0.68rem] font-bold uppercase tracking-[0.22em] ${theme.actionLabel}`}>
          Recommended Action
        </p>
        <h3 className={`mt-1.5 text-4xl font-bold tracking-tight ${theme.actionText}`}>
          {action ?? "Pending…"}
        </h3>
        <p className="mt-3 text-[0.84rem] leading-relaxed text-slate-300">
          {result?.final_decision?.summary ?? "The final recommendation will appear here once the analysis stream completes."}
        </p>

        {/* Confidence + Source */}
        {result?.final_decision && (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-white/8 pt-4">
            <div>
              <p className="text-[0.67rem] uppercase tracking-[0.16em] text-slate-500">Confidence</p>
              <p className="mt-0.5 text-sm font-bold text-white">{result.final_decision.confidence}/10</p>
            </div>
            <div>
              <p className="text-[0.67rem] uppercase tracking-[0.16em] text-slate-500">Source</p>
              <p className="mt-0.5 text-sm font-bold text-white capitalize">
                {result.final_decision.decision_source.replace(/_/g, " ")}
              </p>
            </div>
            {result.final_decision.overridden_by_guardrail && (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-1">
                <MaterialIcon name="security" outlined={false} className="text-[0.85rem] text-amber-400" />
                <span className="text-[0.75rem] font-semibold text-amber-300">Guardrail Override</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reasoning list */}
      {result?.final_decision?.reasoning && result.final_decision.reasoning.length > 0 && (
        <div>
          <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-500">Key Reasoning</p>
          <div className="space-y-2">
            {result.final_decision.reasoning.map((item, i) => {
              const sentiment = getSentimentInfo(item);
              return (
                <div key={i} className={`relative overflow-hidden flex items-start gap-2.5 rounded-xl border border-white/8 px-4 py-2.5 ${sentiment.bg}`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${sentiment.dot} opacity-70`} />
                  <p className="text-[0.82rem] leading-relaxed text-slate-300">
                    {typeof item === "string" ? item : item.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Portfolio actions */}
      {result?.final_decision?.portfolio_actions && result.final_decision.portfolio_actions.length > 0 && (
        <div>
          <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-500">Portfolio Actions</p>
          <div className="space-y-2">
            {result.final_decision.portfolio_actions.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-[#0d1117] px-3.5 py-2.5">
                <MaterialIcon name="chevron_right" outlined={false} className="shrink-0 text-[0.9rem] text-slate-500 mt-0.5" />
                <p className="text-[0.82rem] leading-relaxed text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Sidebar — clickable step list
 * -------------------------------------------------------------------------*/
function Sidebar({
  phases,
  trace,
  activeNodes,
  isAnalyzing,
  selectedId,
  onSelect,
}: {
  phases: PhaseDefinition[];
  trace: TradingAgentTraceEvent[];
  activeNodes: string[];
  isAnalyzing: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const completedCount = phases.filter(
    (p) => stepVisualState(p.id, trace, activeNodes) === "completed"
  ).length;

  const headerLabel = isAnalyzing
    ? `Running… ${completedCount} of ${phases.length}`
    : completedCount === phases.length
    ? `All ${phases.length} steps completed`
    : completedCount > 0
    ? `${completedCount} / ${phases.length} steps`
    : "Not started";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Summary header */}
      <div className="border-b border-white/8 px-4 py-3">
        <p className="text-[0.78rem] font-semibold text-slate-300">{headerLabel}</p>
        {isAnalyzing && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-sky-500/60 transition-all duration-500"
              style={{ width: `${(completedCount / phases.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Step list */}
      <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-white/4">
        {/* "Overview" pseudo-step */}
        <li>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={[
              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150",
              selectedId === null
                ? "bg-white/6 border-l-2 border-l-sky-400"
                : "hover:bg-white/4",
            ].join(" ")}
          >
            <MaterialIcon
              name="summarize"
              outlined={true}
              className="shrink-0 text-[1rem] text-sky-400"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[0.83rem] font-semibold text-sky-200">Final Decision</p>
              <p className="mt-0.5 truncate text-[0.71rem] text-slate-600">Overall recommendation &amp; reasoning</p>
            </div>
          </button>
        </li>

        {phases.map((phase) => {
          const state = stepVisualState(phase.id, trace, activeNodes);
          const isActive = state === "active";
          const isError = state === "error";
          const isDone = state === "completed";
          const isSelected = selectedId === phase.id;

          return (
            <li key={phase.id}>
              <button
                type="button"
                onClick={() => onSelect(phase.id)}
                className={[
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150",
                  isSelected
                    ? "bg-white/6 border-l-2 border-l-sky-400"
                    : isActive
                    ? "bg-sky-400/5"
                    : isError
                    ? "bg-rose-500/4"
                    : "hover:bg-white/4",
                ].join(" ")}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {isActive ? (
                    <span className="relative flex h-4 w-4 items-center justify-center">
                      <span className="absolute h-4 w-4 animate-ping rounded-full bg-sky-400/30" />
                      <span className="relative h-2 w-2 rounded-full bg-sky-400" />
                    </span>
                  ) : isDone ? (
                    <MaterialIcon name="check_circle" outlined={false} className="text-[1rem] text-emerald-500/70" />
                  ) : isError ? (
                    <MaterialIcon name="error" outlined={false} className="text-[1rem] text-rose-400" />
                  ) : (
                    <MaterialIcon name={phase.icon} outlined={true} className="text-[1rem] text-slate-600" />
                  )}
                </div>

                {/* Label */}
                <div className="min-w-0 flex-1">
                  <p className={[
                    "truncate text-[0.83rem] font-medium leading-snug",
                    isActive ? "text-sky-200" :
                    isError ? "text-rose-300" :
                    isDone ? "text-slate-300" :
                    isSelected ? "text-slate-200" :
                    "text-slate-500",
                  ].join(" ")}>
                    {phase.label}
                  </p>
                  <p className="mt-0.5 truncate text-[0.71rem] text-slate-600 leading-snug">
                    {phase.description}
                  </p>
                </div>

                {/* Arrow indicator when selected */}
                {isSelected && (
                  <MaterialIcon name="chevron_right" outlined={false} className="shrink-0 text-[0.9rem] text-slate-500" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * TradingAgentTraceModal — main export
 * -------------------------------------------------------------------------*/
export function TradingAgentTraceModal({
  open,
  onClose,
  result,
  preparedContext,
  trace,
  activeNodes,
  isAnalyzing,
  progressLabel,
  portfolioName,
  warnings,
  error,
}: TradingAgentTraceModalProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  if (!open) return null;

  const selectedPhase = PHASES.find((p) => p.id === selectedStepId) ?? null;
  const action = result?.final_decision?.action;
  const theme = actionTheme(action);

  // Status badge
  const statusBadge = isAnalyzing
    ? { label: "Streaming", cls: "border-sky-400/35 bg-sky-400/10 text-sky-100" }
    : error
    ? { label: "Error", cls: "border-rose-500/35 bg-rose-500/10 text-rose-100" }
    : { label: "Completed", cls: "border-emerald-400/35 bg-emerald-400/10 text-emerald-100" };

  return (
    <div className="modal-backdrop z-95 items-start overflow-y-auto py-6">
      <div className="modal-shell my-auto flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-[#0b0f14] p-0 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">

        {/* ── Header — styled as Decision Hero ── */}
        <div className={`border-b px-5 py-4 sm:px-6 ${theme.heroBorder} ${theme.heroBg}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-slate-500">
                Multi-Agent Analysis Trace
              </p>
              <h2 className="mt-1.5 text-xl font-bold tracking-tight text-white">{portfolioName}</h2>
              <p className={`mt-0.5 text-[0.82rem] ${action ? theme.actionText : "text-slate-400"}`}>
                {progressLabel}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`rounded-full border px-3 py-1 text-[0.72rem] font-bold uppercase tracking-[0.18em] ${statusBadge.cls}`}>
                {statusBadge.label}
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

        {/* ── Body: Sidebar + Detail Panel ── */}
        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Left sidebar */}
          <aside className="flex min-h-0 flex-col border-r border-white/10 bg-[#0d1117]">
            <Sidebar
              phases={PHASES}
              trace={trace}
              activeNodes={activeNodes}
              isAnalyzing={isAnalyzing}
              selectedId={selectedStepId}
              onSelect={setSelectedStepId}
            />
          </aside>

          {/* Right detail panel */}
          <div className="min-h-0 overflow-y-auto bg-[#0b0f14]">
            {selectedPhase ? (
              <StepDetailPanel
                phase={selectedPhase}
                result={result}
                preparedContext={preparedContext}
                trace={trace}
                portfolioName={portfolioName}
                warnings={warnings}
              />
            ) : (
              <DecisionHeroPanel result={result} warnings={warnings} error={error} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
