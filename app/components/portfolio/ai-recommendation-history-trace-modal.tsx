"use client";

import { useEffect, useState } from "react";

import { MaterialIcon } from "../dashboard/material-icon";
import type { PortfolioAIRecommendationHistoryItem } from "@/app/lib/portfolio-types";
import { buildTradingAgentResultFromRecommendation } from "@/app/lib/trading-agent-rehydration";
import {
  DetailSectionView,
  PrepareContextExplainPanel,
  buildTradingAgentTraceStepDetail,
  actionTheme,
  TRADING_AGENT_TRACE_PHASES as PHASES,
} from "./trading-agent-trace-content";
import { formatDateTime, shortSessionId } from "./ai-recommendation-history-utils";

type Props = {
  open: boolean;
  onClose: () => void;
  item: PortfolioAIRecommendationHistoryItem | null;
  portfolioName: string;
};
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

function StepDetailPanel({
  phase,
  item,
}: {
  phase: (typeof PHASES)[number];
  item: PortfolioAIRecommendationHistoryItem;
}) {
  const recommendation = item.recommendation;
  const analysisResult =
    recommendation.analysisResult ?? buildTradingAgentResultFromRecommendation(recommendation);
  const preparedContext = recommendation.preparedContext ?? null;
  const traceDetail =
    recommendation.analysisResult?.trace.find((traceEvent) => traceEvent.step === phase.id)?.detail ??
    `Record ${shortSessionId(item.id)} · Session ${shortSessionId(item.portfolioUiSessionId)}`;
  const content = buildTradingAgentTraceStepDetail(phase, {
    result: analysisResult,
    preparedContext,
    traceDetail,
  });

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

      {phase.id === "prepare_context" ? (
        <PrepareContextExplainPanel preparedContext={preparedContext} warnings={recommendation.analysisResult?.warnings ?? []} />
      ) : (
        content.sections?.map((section) => <DetailSectionView key={section.heading} section={section} />)
      )}

      {phase.id !== "prepare_context" && (!content.sections || content.sections.length === 0) && (
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
                  isSelected ? "bg-white/6 border-l-2 border-l-sky-400" : isDone ? "bg-white/1.5 hover:bg-white/4" : "hover:bg-white/4",
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
