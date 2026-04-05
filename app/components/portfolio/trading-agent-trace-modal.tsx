"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { MaterialIcon } from "../dashboard/material-icon";
import type { TradingAgentResult, TradingAgentTraceEvent } from "@/app/lib/trading-agent-types";

type TradingAgentTraceModalProps = {
  open: boolean;
  onClose: () => void;
  result: TradingAgentResult | null;
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
};

const PHASES: PhaseDefinition[] = [
  { id: "validate_inputs", label: "Validate Inputs", description: "Confirm the request shape and asset list before any model work begins." },
  { id: "prepare_context", label: "Prepare Context", description: "Collect market data, news inputs, and portfolio context for all downstream agents." },
  { id: "technical_analyst", label: "Technical Analyst", description: "Assess trend, momentum, and strongest versus weakest positions." },
  { id: "news_analyst", label: "News Analyst", description: "Review catalysts, headwinds, and how the external narrative affects the portfolio." },
  { id: "sentiment_analyst", label: "Sentiment Analyst", description: "Measure crowd mood and whether positioning is helping or hurting the setup." },
  { id: "portfolio_structure_analyst", label: "Portfolio Structure Analyst", description: "Check concentration, cash flexibility, and structural resilience." },
  { id: "bull_researcher", label: "Bull Researcher", description: "Build the positive case for holding or adding risk." },
  { id: "bear_researcher", label: "Bear Researcher", description: "Challenge the thesis and surface downside risk." },
  { id: "investment_manager", label: "Investment Manager", description: "Turn the debate into a portfolio stance." },
  { id: "trader", label: "Trader Proposal", description: "Translate the stance into an actionable execution proposal." },
  { id: "aggressive_risk_analyst", label: "Aggressive Risk", description: "Argue for preserving upside and tolerating more risk." },
  { id: "conservative_risk_analyst", label: "Conservative Risk", description: "Argue for capital protection and tighter constraints." },
  { id: "neutral_risk_analyst", label: "Neutral Risk", description: "Balance the aggressive and conservative positions." },
  { id: "risk_judge", label: "Risk Judge", description: "Synthesize risk perspectives into a final risk judgment." },
  { id: "guardrails", label: "Guardrails", description: "Apply non-negotiable safety overrides to the action." },
  { id: "finalize_response", label: "Finalize Response", description: "Assemble the final payload for the UI and persistence layer." },
];

function stepVisualState(stepId: string, trace: TradingAgentTraceEvent[], activeNodes: string[]) {
  if (activeNodes.includes(stepId)) {
    return "active";
  }

  const traceEvent = trace.find((item) => item.step === stepId);
  if (!traceEvent) {
    return "pending";
  }

  if (traceEvent.status === "error") {
    return "error";
  }

  return "completed";
}

// Icon for each phase type, matching the screenshot aesthetic
function PhaseIcon({ phaseId, state }: { phaseId: string; state: "pending" | "active" | "completed" | "error" }) {
  const iconName =
    phaseId === "validate_inputs" ? "check_circle" :
    phaseId === "prepare_context" ? "database" :
    phaseId === "technical_analyst" ? "candlestick_chart" :
    phaseId === "news_analyst" ? "language" :
    phaseId === "sentiment_analyst" ? "language" :
    phaseId === "portfolio_structure_analyst" ? "pie_chart" :
    phaseId === "bull_researcher" ? "trending_up" :
    phaseId === "bear_researcher" ? "trending_down" :
    phaseId === "investment_manager" ? "account_balance" :
    phaseId === "trader" ? "bolt" :
    phaseId.includes("risk") ? "bolt" :
    phaseId === "guardrails" ? "shield" :
    "task_alt";

  const colorClass =
    state === "active" ? "text-sky-400" :
    state === "completed" ? "text-slate-400" :
    state === "error" ? "text-rose-400" :
    "text-slate-600";

  return <MaterialIcon name={iconName} outlined={true} className={`text-[1rem] shrink-0 ${colorClass}`} />;
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#12161d] p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SummaryList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No detail was returned for this section.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="rounded-xl border border-white/8 bg-[#0d1117] px-3 py-2 text-sm text-slate-300">
          {item}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * StepList — flat list sidebar, styled after the screenshot
 * -------------------------------------------------------------------------*/
type StepListProps = {
  phases: PhaseDefinition[];
  trace: TradingAgentTraceEvent[];
  activeNodes: string[];
  isAnalyzing: boolean;
};

function StepList({ phases, trace, activeNodes, isAnalyzing }: StepListProps) {
  const [collapsed, setCollapsed] = useState(false);

  const completedCount = phases.filter(
    (p) => stepVisualState(p.id, trace, activeNodes) === "completed"
  ).length;

  const headerLabel = isAnalyzing
    ? `Running… ${completedCount} of ${phases.length} steps`
    : completedCount === phases.length
    ? `Completed ${completedCount} steps`
    : completedCount > 0
    ? `${completedCount} of ${phases.length} steps completed`
    : "Not started";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* ── Header row ── */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-1.5 border-b border-white/8 px-4 py-3.5 text-left"
      >
        <span className="flex-1 text-[0.83rem] font-semibold text-slate-200">{headerLabel}</span>
        <MaterialIcon
          name="expand_more"
          outlined={false}
          className={`text-base text-slate-500 transition-transform duration-200 ${collapsed ? "-rotate-90" : "rotate-0"}`}
        />
      </button>

      {/* ── Step rows ── */}
      {!collapsed && (
        <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-white/5">
          {phases.map((phase) => {
            const state = stepVisualState(phase.id, trace, activeNodes);
            const isActive = state === "active";
            const isError = state === "error";
            const isDone = state === "completed";

            return (
              <li
                key={phase.id}
                className={[
                  "flex items-center gap-3 px-4 py-3 transition-colors duration-150",
                  isActive
                    ? "bg-sky-400/[0.07]"
                    : isError
                    ? "bg-rose-500/5"
                    : "hover:bg-white/2.5",
                ].join(" ")}
              >
                {/* Icon */}
                <PhaseIcon phaseId={phase.id} state={state} />

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      "truncate text-[0.83rem] font-medium leading-snug",
                      isActive
                        ? "text-sky-200"
                        : isError
                        ? "text-rose-300"
                        : isDone
                        ? "text-slate-300"
                        : "text-slate-500",
                    ].join(" ")}
                  >
                    {phase.label}
                  </p>
                  <p className="mt-0.5 truncate text-[0.73rem] leading-snug text-slate-600">
                    {phase.description}
                  </p>
                </div>

                {/* Trailing indicator */}
                {isActive && (
                  <span className="inline-flex h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-sky-400" />
                )}
                {isDone && (
                  <MaterialIcon
                    name="check"
                    outlined={false}
                    className="shrink-0 text-[0.85rem] text-emerald-500"
                  />
                )}
                {isError && (
                  <MaterialIcon
                    name="error"
                    outlined={false}
                    className="shrink-0 text-[0.85rem] text-rose-400"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TradingAgentTraceModal({
  open,
  onClose,
  result,
  trace,
  activeNodes,
  isAnalyzing,
  progressLabel,
  portfolioName,
  warnings,
  error,
}: TradingAgentTraceModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop z-95 items-start overflow-y-auto py-6">
      <div className="modal-shell my-auto flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-[#0b0f14] p-0 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="border-b border-white/10 bg-[#0f141b] px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Multi-Agent Analysis Trace</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{portfolioName}</h2>
              <p className="mt-1 text-sm text-slate-400">{progressLabel}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${isAnalyzing ? "border-sky-400/35 bg-sky-400/10 text-sky-100" : error ? "border-rose-500/35 bg-rose-500/10 text-rose-100" : "border-emerald-400/35 bg-emerald-400/10 text-emerald-100"}`}>
                {isAnalyzing ? "Streaming" : error ? "Error" : "Completed"}
              </span>
              <button type="button" onClick={onClose} className="icon-button h-10 w-10" aria-label="Close trace modal">
                <MaterialIcon name="close" outlined={false} className="text-xl" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-white/10 bg-[#0d1117]">
            <StepList phases={PHASES} trace={trace} activeNodes={activeNodes} isAnalyzing={isAnalyzing} />
          </aside>

          <div className="min-h-0 overflow-y-auto bg-[#0b0f14] px-4 py-4 sm:px-5">
            {warnings.length > 0 ? (
              <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
                {warnings[0]}
              </div>
            ) : null}

            {error ? (
              <div className="mb-4 rounded-2xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Recommended Decision">
                <div className="rounded-2xl border border-white/8 bg-[#0d1117] p-4">
                  <p className="text-[0.72rem] uppercase tracking-[0.18em] text-slate-500">Action</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{result?.final_decision?.action ?? "Pending"}</p>
                  <p className="mt-2 text-sm text-slate-400">{result?.final_decision?.summary ?? "The final decision will appear here as the stream completes."}</p>
                </div>
              </SectionCard>

              <SectionCard title="Trace Log">
                <div className="space-y-2">
                  {trace.length === 0 ? (
                    <p className="text-sm text-slate-500">Waiting for workflow events.</p>
                  ) : (
                    trace.map((item, index) => (
                      <div key={`${item.step}-${item.status}-${index}`} className="rounded-xl border border-white/8 bg-[#0d1117] px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white">{item.step}</p>
                          <span className="text-[0.68rem] uppercase tracking-[0.16em] text-slate-400">{item.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Analyst Outputs">
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium text-white">Technical analyst</p>
                    <SummaryList items={result?.analyst_reports?.technical ? [
                      result.analyst_reports.technical.summary,
                      ...result.analyst_reports.technical.evidence,
                    ] : []} />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-white">News analyst</p>
                    <SummaryList items={result?.analyst_reports?.news ? [
                      result.analyst_reports.news.summary,
                      ...result.analyst_reports.news.catalysts,
                      ...result.analyst_reports.news.headwinds,
                    ] : []} />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-white">Sentiment analyst</p>
                    <SummaryList items={result?.analyst_reports?.sentiment ? [
                      result.analyst_reports.sentiment.summary,
                      ...result.analyst_reports.sentiment.drivers,
                    ] : []} />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-white">Portfolio structure analyst</p>
                    <SummaryList items={result?.analyst_reports?.portfolio_structure ? [
                      result.analyst_reports.portfolio_structure.summary,
                      ...result.analyst_reports.portfolio_structure.actions,
                    ] : []} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Debate And Risk Flow">
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium text-white">Investment debate</p>
                    <SummaryList items={result?.investment_debate ? [
                      result.investment_debate.bull_case,
                      result.investment_debate.bear_case,
                      result.investment_debate.manager_summary,
                    ].filter(Boolean) : []} />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-white">Trader proposal</p>
                    <SummaryList items={result?.trader_proposal ? [
                      result.trader_proposal.thesis,
                      ...result.trader_proposal.implementation_steps,
                    ] : []} />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-white">Risk debate</p>
                    <SummaryList items={result?.risk_debate ? [
                      result.risk_debate.aggressive_view,
                      result.risk_debate.conservative_view,
                      result.risk_debate.neutral_view,
                      result.risk_debate.judge_summary,
                      ...result.risk_debate.constraints,
                    ].filter(Boolean) : []} />
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
