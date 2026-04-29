"use client";

import { useState } from "react";

import { MaterialIcon } from "../dashboard/material-icon";
import type { AIAnalysisSentimentText } from "@/app/lib/portfolio-types";
import type {
  TradingAgentPreparedContext,
  TradingAgentResult,
  TradingAgentTraceEvent,
} from "@/app/lib/trading-agent-types";

export type PhaseDefinition = {
  id: string;
  label: string;
  description: string;
  icon: string;
};

export const TRADING_AGENT_TRACE_PHASES: PhaseDefinition[] = [
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

export type DetailSection = {
  heading: string;
  items: (string | AIAnalysisSentimentText)[];
  isChecklist?: boolean;
  forcedSentiment?: "Bullish" | "Bearish" | "Neutral";
};

export type StepDetailContent = {
  title: string;
  subtitle?: string;
  badge?: { label: string; color: string };
  metrics?: { label: string; value: string; color?: string }[];
  sections?: DetailSection[];
  traceDetail?: string;
};

export type TradingAgentTraceStepDetailInput = {
  result: TradingAgentResult | null;
  preparedContext: TradingAgentPreparedContext | null;
  traceDetail?: string;
};

export function actionTheme(action: string | undefined) {
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

export function getSentimentInfo(value: string | AIAnalysisSentimentText) {
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

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatUsd(value: number | null | undefined): string {
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

export function buildTradingAgentTraceStepDetail(
  phase: PhaseDefinition,
  { result, traceDetail }: TradingAgentTraceStepDetailInput
): StepDetailContent {
  const base: StepDetailContent = {
    title: phase.label,
    subtitle: phase.description,
    traceDetail,
  };

  switch (phase.id) {
    case "validate_inputs": {
      const meta = result?.meta;
      const validatedItems: string[] = [];

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

    case "prepare_context":
      return base;

    case "technical_analyst": {
      const r = result?.analyst_reports?.technical;
      if (!r) return base;

      return {
        ...base,
        badge: {
          label: r.portfolio_trend,
          color:
            r.portfolio_trend === "Bullish"
              ? "status-badge-success-soft"
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
              ? "status-badge-success-soft"
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
              ? "status-badge-success-soft"
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
              ? "status-badge-success-soft"
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
        sections: [{ heading: "Bull Case", items: [r.bull_case], forcedSentiment: "Bullish" }],
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
            forcedSentiment: "Bearish",
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
        metrics: decision ? [{ label: "Confidence", value: `${decision.confidence}/10` }] : undefined,
        sections: [
          ...(debate ? [{ heading: "Manager's Synthesis", items: [debate.manager_summary].filter(Boolean) }] : []),
          ...(decision
            ? [
                { heading: "Stance Summary", items: [decision.summary] },
                { heading: "Reasoning", items: decision.reasoning },
              ]
            : []),
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
              ? "status-badge-success-soft"
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

    case "guardrails":
      return base;

    case "finalize_response": {
      const r = result?.final_decision;
      if (!r) return base;

      return {
        ...base,
        badge: {
          label: r.action,
          color: "status-badge-success-soft",
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

export function DetailSectionView({ section }: { section: DetailSection }) {
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
              className={`relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-white/8 bg-[#0d1117] px-3.5 py-2.5 text-[0.83rem] leading-relaxed text-slate-300 ${tone?.bg || ""}`}
            >
              {!section.isChecklist && tone && <div className={`absolute bottom-0 left-0 top-0 w-0.75 ${tone.dot} opacity-70`} />}
              {section.isChecklist && (
                <MaterialIcon name="check_circle" outlined={false} className="text-success-dim flex h-5 w-5 shrink-0 items-center justify-center text-[0.9rem] leading-none" />
              )}
              <span className="flex-1 whitespace-pre-wrap">{typeof item === "string" ? item : item.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PrepareContextExplainPanel({
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
    .map((position) => `${position.symbol} at ${formatPercent(position.weight)} (${formatUsd(position.value_usd)})`);

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
            news?.news_headlines?.slice(0, 4).map((line) => `- ${line}`) ?? [
              "No headline highlights are available yet.",
            ],
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
      badge: structure
        ? `Top1 ${formatPercent(structure.top1_weight)} / Top2 ${formatPercent(structure.top2_weight)}`
        : "No structure",
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
              onClick={() => setOpenCard((previous) => (previous === card.id ? null : card.id))}
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
                    <p className="ml-1 text-[0.72rem] font-semibold uppercase tracking-[0.15em] text-slate-500">{section.heading}</p>
                    <div className="space-y-2">
                      {section.lines.map((line, index) => {
                        const sentimentTone = getSentimentInfo(line);

                        return (
                          <div
                            key={`${card.id}-${section.heading}-${index}`}
                            className={`relative overflow-hidden rounded-xl border border-white/8 ${sentimentTone.bg} px-4 py-3`}
                          >
                            <div className={`absolute bottom-0 left-0 top-0 w-1 ${sentimentTone.dot} opacity-60`} />
                            <p className="text-[0.83rem] leading-relaxed text-slate-300">{line}</p>
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
