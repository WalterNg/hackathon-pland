import type { PortfolioAIRecommendation } from "@/app/lib/portfolio-types";
import type { AIAnalysisStep, AIAnalysisStepId } from "@/app/hooks/use-portfolio-ai-analysis";
import { MaterialIcon } from "../dashboard/material-icon";
import { XAIEvidenceLinking } from "./xai-evidence-linking";

type AIRecommendationCardProps = {
  recommendation: PortfolioAIRecommendation | null;
  isAnalyzing: boolean;
  activeStepId: AIAnalysisStepId | null;
  steps: AIAnalysisStep[];
  error: string | null;
  onAnalyze: () => void;
  isDisabled?: boolean;
};

type SignalTone = PortfolioAIRecommendation["signals"][number]["tone"];

function actionClasses(action: PortfolioAIRecommendation["action"]): string {
  if (action === "Accumulate") {
    return "bg-success-soft text-success";
  }

  if (action === "Hold") {
    return "bg-info-soft text-info";
  }

  if (action === "Rebalance") {
    return "bg-primary text-on-primary";
  }

  return "bg-danger-soft text-danger";
}

function actionHeroClasses(action: PortfolioAIRecommendation["action"]): string {
  if (action === "Accumulate") {
    return "border-emerald-500/20 bg-[linear-gradient(135deg,rgba(60,227,106,0.16),rgba(25,28,34,0.98))]";
  }

  if (action === "Hold") {
    return "border-sky-500/20 bg-[linear-gradient(135deg,rgba(136,180,255,0.14),rgba(25,28,34,0.98))]";
  }

  if (action === "Rebalance") {
    return "border-teal-500/20 bg-[linear-gradient(135deg,rgba(60,227,106,0.12),rgba(25,28,34,0.98))]";
  }

  return "border-rose-500/20 bg-[linear-gradient(135deg,rgba(235,68,70,0.14),rgba(25,28,34,0.98))]";
}

function formatTimestamp(value: string): string {
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

type AgentCardState = {
  key: "quant" | "macro" | "risk";
  label: string;
  signalText: string;
  tone: SignalTone;
  emphasized?: boolean;
};

function tonePanelClasses(tone: SignalTone): string {
  if (tone === "Bullish") {
    return "border-emerald-400/30 bg-emerald-500/10";
  }

  if (tone === "Bearish" || tone === "Defensive") {
    return "border-rose-400/40 bg-rose-500/10";
  }

  if (tone === "Cautious") {
    return "border-amber-300/40 bg-amber-500/10";
  }

  return "border-sky-300/35 bg-sky-500/10";
}

function buildAgentCards(recommendation: PortfolioAIRecommendation | null): AgentCardState[] {
  const taSignal = recommendation?.signals.find((signal) => signal.label === "TA");
  const marketSignal = recommendation?.signals.find((signal) => signal.label === "News / Market");
  const riskSignal = recommendation?.signals.find((signal) => signal.label === "Risk");

  const riskTone = riskSignal?.tone ?? "Defensive";

  return [
    {
      key: "quant",
      label: "Quant / TA Agent",
      signalText: `Signal: ${taSignal?.tone ?? "Bullish"}`,
      tone: taSignal?.tone ?? "Bullish",
    },
    {
      key: "macro",
      label: "Macro / News Agent",
      signalText: `Signal: ${marketSignal?.tone ?? "Neutral"}`,
      tone: marketSignal?.tone ?? "Neutral",
    },
    {
      key: "risk",
      label: "Risk Manager Agent",
      signalText:
        riskTone === "Defensive"
          ? "Signal: Defensive / Critical Risk"
          : `Signal: ${riskTone}`,
      tone: riskTone,
      emphasized: true,
    },
  ];
}

export function AIRecommendationCard({
  recommendation,
  isAnalyzing,
  activeStepId,
  steps,
  error,
  onAnalyze,
  isDisabled = false,
}: AIRecommendationCardProps) {
  const activeStepLabel = steps.find((step) => step.id === activeStepId)?.label ?? null;
  const riskSignal = recommendation?.signals.find((signal) => signal.label === "Risk");
  const agentCards = buildAgentCards(recommendation);
  const isRiskDriven =
    recommendation &&
    (recommendation.action === "Stop Loss" ||
      recommendation.action === "Reduce Risk" ||
      riskSignal?.tone === "Defensive" ||
      riskSignal?.tone === "Cautious");

  return (
    <section className="panel-base mb-6 overflow-hidden lg:mb-8">
      <div className="border-b border-white/6 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-(--surface-container-low) text-primary shadow-sm">
                <MaterialIcon name="auto_awesome" outlined={false} className="text-lg" />
              </span>
              <div>
                <h3 className="section-title">AI Recommendation</h3>
                <p className="typo-body-sm text-muted">Portfolio-level recommendation built from TA, market context, and risk.</p>
              </div>
            </div>

            {recommendation && !isAnalyzing && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/6 bg-white/5 px-3 py-1 text-xs font-semibold text-muted">
                  Confidence {recommendation.confidence}/10
                </span>
                <span className="rounded-full border border-white/6 bg-white/5 px-3 py-1 text-xs font-semibold text-muted">
                  Analyzed at {formatTimestamp(recommendation.analyzedAt)}
                </span>
                <span className="rounded-full border border-white/6 bg-white/5 px-3 py-1 text-xs font-semibold text-muted">
                  Binance snapshot {formatTimestamp(recommendation.snapshotTimestamp)}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={isDisabled || isAnalyzing}
            className="typo-body-sm inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-(--surface-container-low) px-5 py-3 font-semibold text-strong shadow-sm transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MaterialIcon name={isAnalyzing ? "hourglass_top" : "auto_awesome"} outlined={false} className="text-sm" />
            Analyze with AI
          </button>
        </div>
      </div>

      {isAnalyzing && (
        <div className="px-5 py-5 sm:px-6">
          <div className="mb-6 rounded-2xl border border-primary/30 bg-mint-light p-4">
            <p className="text-sm font-semibold text-strong">Processing with parallel agents...</p>
            <p className="mt-1 text-sm text-muted">
              {activeStepLabel ? `${activeStepLabel}. ` : ""}
              All agents are running simultaneously before the final synthesis.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {agentCards.map((agent) => (
              <article key={agent.key} className="rounded-2xl border border-white/8 bg-(--surface-container-low) p-4">
                <p className="text-sm font-semibold text-strong">{agent.label}</p>
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-3/4 animate-pulse rounded-full bg-white/15" />
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/10" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/15" />
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-(--surface-container-low) px-5 py-3">
              <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
              <p className="text-sm font-semibold text-strong">Synthesizing Final Call...</p>
            </div>
          </div>
        </div>
      )}

      {!isAnalyzing && !recommendation && (
        <div className="px-5 py-8 sm:px-6">
          <div className="rounded-2xl border border-dashed border-white/10 bg-(--surface-container-low) px-5 py-8 text-center">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/6 bg-white/5 text-primary">
              <MaterialIcon name="auto_awesome" outlined={false} className="text-lg" />
            </div>
            <p className="text-base font-semibold text-strong">No AI recommendation yet</p>
            <p className="mt-2 text-sm text-muted">
              Run a portfolio-level analysis to generate one recommendation with TA, market context, risk checks, and a timestamp.
            </p>
            {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
          </div>
        </div>
      )}

      {!isAnalyzing && recommendation && error && (
        <div className="px-5 pb-0 pt-5 sm:px-6">
          <div className="rounded-2xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">
            Latest analysis could not be refreshed: {error}
          </div>
        </div>
      )}

      {recommendation && !isAnalyzing && (
        <div className="px-5 py-5 sm:px-6">
          <div className="mb-6">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {agentCards.map((agent) => (
                <article
                  key={agent.key}
                  className={`rounded-2xl border p-4 transition-transform ${
                    agent.emphasized
                      ? `${tonePanelClasses(agent.tone)} scale-[1.02] border-2 shadow-[0_12px_30px_rgba(235,68,70,0.16)]`
                      : `${tonePanelClasses(agent.tone)} border`
                  }`}
                >
                  <p className="text-sm font-semibold text-strong">{agent.label}</p>
                  <p className="mt-3 text-lg font-bold text-strong">{agent.signalText}</p>
                </article>
              ))}
            </div>

            <div className="my-4 flex justify-center">
              <svg viewBox="0 0 100 42" className="h-12 w-full max-w-xl text-white/25" aria-hidden>
                <path d="M16 2 L16 16 L50 34" stroke="currentColor" strokeWidth="1.3" fill="none" />
                <path d="M50 2 L50 34" stroke="currentColor" strokeWidth="1.3" fill="none" />
                <path d="M84 2 L84 16 L50 34" stroke="currentColor" strokeWidth="1.3" fill="none" />
                <circle cx="50" cy="34" r="2.3" fill="currentColor" />
              </svg>
            </div>

            <div
              className={`rounded-3xl border p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-7 ${actionHeroClasses(
                recommendation.action,
              )}`}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${actionClasses(recommendation.action)}`}>
                  Consensus Output
                </span>
                {isRiskDriven && (
                  <span className="rounded-full bg-danger-soft px-3 py-1 text-xs font-bold text-danger">
                    Risk-driven decision
                  </span>
                )}
                {riskSignal?.tone === "Defensive" && (
                  <span className="rounded-full bg-danger-soft px-3 py-1 text-xs font-bold text-danger">
                    Critical risk override
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">Final Decision Node</p>
              <h4 className="mt-2 text-3xl font-bold tracking-tight text-strong sm:text-4xl">
                FINAL SIGNAL: {recommendation.action.toUpperCase()}
              </h4>
              <p className="mt-3 text-lg font-semibold text-strong">Confidence Score: {recommendation.confidence}/10</p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-body">{recommendation.summary}</p>
            </div>
          </div>

          <XAIEvidenceLinking recommendation={recommendation} />
        </div>
      )}
    </section>
  );
}
