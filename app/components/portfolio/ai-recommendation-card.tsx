import type { PortfolioAIRecommendation, PortfolioSnapshot } from "@/app/lib/portfolio-types";
import type { AIAnalysisStep, AIAnalysisStepId } from "@/app/hooks/use-portfolio-ai-analysis";
import { MaterialIcon } from "../dashboard/material-icon";

type AIRecommendationCardProps = {
  recommendation: PortfolioAIRecommendation | null;
  snapshot: PortfolioSnapshot | null;
  isAnalyzing: boolean;
  activeStepId: AIAnalysisStepId | null;
  steps: AIAnalysisStep[];
  error: string | null;
  onAnalyze: () => void;
  isDisabled?: boolean;
};

type SignalTone = PortfolioAIRecommendation["signals"][number]["tone"];

function signalToneClasses(tone: SignalTone): string {
  if (tone === "Bullish") {
    return "bg-success-soft text-success";
  }

  if (tone === "Bearish" || tone === "Defensive") {
    return "bg-danger-soft text-danger";
  }

  if (tone === "Cautious") {
    return "bg-orange-100 text-warning";
  }

  return "bg-info-soft text-info";
}

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

function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(digits)}%`;
}

function buildFactItems(snapshot: PortfolioSnapshot | null) {
  if (!snapshot) {
    return [];
  }

  const sortedAssets = [...snapshot.assets].sort((left, right) => right.allocationPercent - left.allocationPercent);
  const topAsset = sortedAssets[0] ?? null;
  const secondAsset = sortedAssets[1] ?? null;

  return [
    {
      label: "Portfolio Value",
      value: formatUsd(snapshot.summary.totalValueUsd),
      detail: "Live mark-to-market valuation",
    },
    {
      label: "BTC Live Price",
      value: formatUsd(snapshot.summary.btcPriceUsd),
      detail: "Spot reference from Binance",
    },
    {
      label: "Top Allocation",
      value: topAsset ? `${topAsset.symbol.replace("USDT", "")} ${topAsset.allocationPercent.toFixed(2)}%` : "N/A",
      detail: secondAsset ? `Next largest: ${secondAsset.symbol.replace("USDT", "")} ${secondAsset.allocationPercent.toFixed(2)}%` : "No secondary holding",
    },
    {
      label: "24h Volume",
      value: formatUsd(snapshot.metrics.totalVolume24hUsd),
      detail: "Aggregated Binance 24h quote volume",
    },
    {
      label: "Risk Score",
      value: snapshot.metrics.riskScore !== undefined ? `${snapshot.metrics.riskScore.toFixed(1)}/100` : "N/A",
      detail: `Max drawdown ${formatPercent(snapshot.metrics.maxDrawdownPercent)}`,
    },
    {
      label: "All-time PnL",
      value: formatPercent(snapshot.metrics.allTimeProfitPercent),
      detail: formatUsd(snapshot.metrics.allTimeProfitUsd),
    },
  ];
}

function explanationBlocks(recommendation: PortfolioAIRecommendation) {
  const taSignal = recommendation.signals.find((signal) => signal.label === "TA");
  const marketSignal = recommendation.signals.find((signal) => signal.label === "News / Market");
  const riskSignal = recommendation.signals.find((signal) => signal.label === "Risk");

  return [
    {
      title: "Technical view",
      tone: taSignal?.tone ?? "Neutral",
      body: taSignal?.summary ?? recommendation.reasoning[0] ?? "Technical context is unavailable.",
    },
    {
      title: "Market context",
      tone: marketSignal?.tone ?? "Neutral",
      body: marketSignal?.summary ?? recommendation.reasoning[1] ?? "Market context is unavailable.",
    },
    {
      title: "Risk reasoning",
      tone: riskSignal?.tone ?? "Neutral",
      body: recommendation.reasoning[2] ?? riskSignal?.summary ?? "Risk reasoning is unavailable.",
    },
  ];
}

export function AIRecommendationCard({
  recommendation,
  snapshot,
  isAnalyzing,
  activeStepId,
  steps,
  error,
  onAnalyze,
  isDisabled = false,
}: AIRecommendationCardProps) {
  const activeStepIndex = activeStepId ? steps.findIndex((step) => step.id === activeStepId) : -1;
  const liveFacts = buildFactItems(snapshot);
  const riskSignal = recommendation?.signals.find((signal) => signal.label === "Risk");
  const explanation = recommendation ? explanationBlocks(recommendation) : [];
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
          <div className="mb-5 rounded-2xl border border-white/6 bg-(--surface-container-low) p-4">
            <p className="text-sm font-semibold text-strong">Thinking through the portfolio...</p>
            <p className="mt-1 text-sm text-muted">The recommendation will update with a fresh timestamp when this run finishes.</p>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => {
              const status =
                activeStepIndex === -1
                  ? "pending"
                  : index < activeStepIndex
                    ? "completed"
                    : index === activeStepIndex
                      ? "active"
                      : "pending";

              return (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                    status === "active"
                      ? "border-primary bg-mint-light"
                      : status === "completed"
                        ? "border-white/6 bg-(--surface-container-low)"
                        : "border-white/6 bg-(--surface-container-low)"
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      status === "completed"
                        ? "bg-success-soft text-success"
                      : status === "active"
                          ? "bg-sidebar-dark text-inverse"
                          : "bg-white/5 text-muted"
                    }`}
                  >
                    <MaterialIcon
                      name={status === "completed" ? "check" : status === "active" ? "more_horiz" : "radio_button_unchecked"}
                      outlined={false}
                      className="text-sm"
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-strong">{step.label}</p>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{status}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{step.description}</p>
                  </div>
                </div>
              );
            })}
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
          <div className={`mb-5 rounded-3xl border p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6 ${actionHeroClasses(recommendation.action)}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${actionClasses(recommendation.action)}`}>
                    Final Recommendation
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
                <h4 className="text-3xl font-bold tracking-tight text-strong sm:text-4xl">{recommendation.action}</h4>
                <p className="mt-3 max-w-2xl text-base leading-7 text-body">{recommendation.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:w-auto">
                <div className="rounded-2xl border border-white/8 bg-(--surface-container) px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Confidence</p>
                  <p className="mt-1 text-2xl font-bold text-strong">{recommendation.confidence}/10</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-(--surface-container) px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Risk signal</p>
                  <p className="mt-1 text-2xl font-bold text-strong">{riskSignal?.tone ?? "Neutral"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-4">
            {recommendation.signals.map((signal) => (
              <article
                key={signal.label}
                className={`rounded-2xl border border-white/6 bg-(--surface-container-low) p-4 ${
                  signal.label === "Risk" ? "lg:col-span-2" : ""
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-strong">{signal.label}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${signalToneClasses(signal.tone)}`}>
                    {signal.tone}
                  </span>
                </div>
                <p className="text-sm leading-6 text-body">{signal.summary}</p>
              </article>
            ))}
          </div>

          <div className="mb-5 rounded-2xl border border-white/6 bg-(--surface-container-low) p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-strong">Live market facts from Binance</h4>
                <p className="mt-1 text-sm text-muted">Evidence pulled from the latest live portfolio snapshot and Binance market prices.</p>
              </div>
              <span className="rounded-full border border-white/6 bg-white/5 px-3 py-1 text-xs font-semibold text-muted">
                Snapshot {formatTimestamp(recommendation.snapshotTimestamp)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {liveFacts.map((fact) => (
                <article key={fact.label} className="rounded-2xl border border-white/6 bg-(--surface-container-low) px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{fact.label}</p>
                  <p className="mt-2 text-xl font-bold text-strong">{fact.value}</p>
                  <p className="mt-1 text-sm text-muted">{fact.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.9fr]">
            <article className="rounded-2xl border border-white/6 bg-(--surface-container-low) p-5">
              <h4 className="mb-4 text-base font-bold text-strong">Why AI recommends this</h4>
              <div className="space-y-3">
                {explanation.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/6 bg-(--surface-container) p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-strong">{item.title}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${signalToneClasses(item.tone as SignalTone)}`}>
                        {item.tone}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-body">{item.body}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/6 bg-(--surface-container) p-4">
                <p className="mb-3 text-sm font-semibold text-strong">Detailed reasoning</p>
                <div className="space-y-2">
                  {recommendation.reasoning.map((reason, index) => (
                    <div key={`${reason}-${index}`} className="flex items-start gap-2 text-sm text-body">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-white/6 bg-(--surface-container-low) p-5">
              <h4 className="mb-4 text-base font-bold text-strong">What to do now</h4>
              <div className="space-y-3">
                {recommendation.portfolioActions.map((action, index) => (
                  <div
                    key={`${action}-${index}`}
                    className={`rounded-2xl px-4 py-4 text-sm leading-6 ${
                      index === 0 ? "border border-primary/30 bg-mint-light text-strong" : "border border-white/6 bg-(--surface-container) text-body"
                    }`}
                  >
                    {action}
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      )}
    </section>
  );
}
