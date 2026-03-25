"use client";

import { useMemo, useState } from "react";

import type { PortfolioAIAnalysisEvidence, PortfolioAIRecommendation } from "@/app/lib/portfolio-types";

type XAIEvidenceLinkingProps = {
  recommendation: PortfolioAIRecommendation;
};

type EvidenceId =
  | "portfolio_value"
  | "top_allocation"
  | "cash_balance"
  | "volume_24h"
  | "risk_score"
  | "volatility";

type EvidenceWidget = {
  id: EvidenceId;
  label: string;
  value: string;
  detail: string;
};

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

function cleanSymbol(symbol: string): string {
  return symbol.replace("USDT", "");
}

function buildWidgets(recommendation: PortfolioAIRecommendation, evidence: PortfolioAIAnalysisEvidence): EvidenceWidget[] {
  return [
    {
      id: "portfolio_value",
      label: "Portfolio Value",
      value: formatUsd(evidence.portfolioValueUsd),
      detail: "Captured at analysis time",
    },
    {
      id: "top_allocation",
      label: "Top Allocation",
      value:
        evidence.topAllocationSymbol && evidence.topAllocationPercent !== null
          ? `${cleanSymbol(evidence.topAllocationSymbol)} ${evidence.topAllocationPercent.toFixed(2)}%`
          : "N/A",
      detail: "Largest portfolio concentration at analysis time",
    },
    {
      id: "cash_balance",
      label: "Cash Balance",
      value: `${formatUsd(evidence.cashBalanceUsd)} (${evidence.cashAllocationPercent.toFixed(2)}%)`,
      detail: "Stablecoin reserve captured for the AI run",
    },
    {
      id: "volume_24h",
      label: "24H Volume",
      value: formatUsd(evidence.volume24hUsd),
      detail: "Aggregated quote volume used in reasoning",
    },
    {
      id: "risk_score",
      label: "Risk Score",
      value: evidence.riskScore !== null ? `${evidence.riskScore.toFixed(1)}/100` : "N/A",
      detail: `AI action: ${recommendation.action}`,
    },
    {
      id: "volatility",
      label: "Volatility",
      value: formatPercent(evidence.volatilityPercent),
      detail: `Max drawdown ${formatPercent(evidence.maxDrawdownPercent)}`,
    },
  ];
}

function buildTokens(evidence: PortfolioAIAnalysisEvidence): Array<{ id: EvidenceId; text: string }> {
  return [
    {
      id: "top_allocation",
      text:
        evidence.topAllocationSymbol && evidence.topAllocationPercent !== null
          ? `${evidence.topAllocationPercent.toFixed(2)}% allocation to ${cleanSymbol(evidence.topAllocationSymbol)}`
          : "No dominant allocation",
    },
    {
      id: "cash_balance",
      text: `${evidence.cashAllocationPercent.toFixed(2)}% cash reserve`,
    },
    {
      id: "volatility",
      text: `High volatility ${evidence.volatilityPercent?.toFixed(2) ?? "N/A"}%`,
    },
    {
      id: "portfolio_value",
      text: `Portfolio value ${formatUsd(evidence.portfolioValueUsd)}`,
    },
    {
      id: "volume_24h",
      text: `24H volume ${formatUsd(evidence.volume24hUsd)}`,
    },
    {
      id: "risk_score",
      text: `Risk score ${evidence.riskScore?.toFixed(1) ?? "N/A"}/100`,
    },
  ];
}

export function XAIEvidenceLinking({ recommendation }: XAIEvidenceLinkingProps) {
  const [activeEvidenceId, setActiveEvidenceId] = useState<EvidenceId | null>(null);
  const evidence = recommendation.evidence;

  const widgets = useMemo(() => buildWidgets(recommendation, evidence), [recommendation, evidence]);
  const tokens = useMemo(() => buildTokens(evidence), [evidence]);

  const interactiveTagClasses = (id: EvidenceId) =>
    `inline-flex cursor-pointer rounded-lg border px-2 py-0.5 text-xs font-semibold transition ${
      activeEvidenceId === id
        ? "border-primary bg-mint-light text-strong"
        : "border-white/12 bg-white/5 text-body hover:border-primary/50 hover:text-strong"
    }`;

  return (
    <section className="mb-5 rounded-2xl border border-white/6 bg-(--surface-container-low) p-5">
      <div className="mb-4">
        <h4 className="text-base font-bold text-strong">Explainable AI Evidence Linking</h4>
        <p className="mt-1 text-sm text-muted">Hover or tap a referenced metric in the reasoning text to link it to the frozen metrics captured for this AI run.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-white/6 bg-(--surface-container) p-4">
          <p className="text-sm leading-7 text-body">
            The portfolio currently shows{" "}
            <button
              type="button"
              className={interactiveTagClasses(tokens[0].id)}
              onMouseEnter={() => setActiveEvidenceId(tokens[0].id)}
              onMouseLeave={() => setActiveEvidenceId(null)}
              onFocus={() => setActiveEvidenceId(tokens[0].id)}
              onBlur={() => setActiveEvidenceId(null)}
              onClick={() => setActiveEvidenceId((current) => (current === tokens[0].id ? null : tokens[0].id))}
            >
              [{tokens[0].text}]
            </button>
            {" "}with only{" "}
            <button
              type="button"
              className={interactiveTagClasses(tokens[1].id)}
              onMouseEnter={() => setActiveEvidenceId(tokens[1].id)}
              onMouseLeave={() => setActiveEvidenceId(null)}
              onFocus={() => setActiveEvidenceId(tokens[1].id)}
              onBlur={() => setActiveEvidenceId(null)}
              onClick={() => setActiveEvidenceId((current) => (current === tokens[1].id ? null : tokens[1].id))}
            >
              [{tokens[1].text}]
            </button>
            . Market conditions remain{" "}
            <button
              type="button"
              className={interactiveTagClasses(tokens[2].id)}
              onMouseEnter={() => setActiveEvidenceId(tokens[2].id)}
              onMouseLeave={() => setActiveEvidenceId(null)}
              onFocus={() => setActiveEvidenceId(tokens[2].id)}
              onBlur={() => setActiveEvidenceId(null)}
              onClick={() => setActiveEvidenceId((current) => (current === tokens[2].id ? null : tokens[2].id))}
            >
              [{tokens[2].text}]
            </button>
            , while the account sits at{" "}
            <button
              type="button"
              className={interactiveTagClasses(tokens[3].id)}
              onMouseEnter={() => setActiveEvidenceId(tokens[3].id)}
              onMouseLeave={() => setActiveEvidenceId(null)}
              onFocus={() => setActiveEvidenceId(tokens[3].id)}
              onBlur={() => setActiveEvidenceId(null)}
              onClick={() => setActiveEvidenceId((current) => (current === tokens[3].id ? null : tokens[3].id))}
            >
              [{tokens[3].text}]
            </button>
            {" "}and{" "}
            <button
              type="button"
              className={interactiveTagClasses(tokens[4].id)}
              onMouseEnter={() => setActiveEvidenceId(tokens[4].id)}
              onMouseLeave={() => setActiveEvidenceId(null)}
              onFocus={() => setActiveEvidenceId(tokens[4].id)}
              onBlur={() => setActiveEvidenceId(null)}
              onClick={() => setActiveEvidenceId((current) => (current === tokens[4].id ? null : tokens[4].id))}
            >
              [{tokens[4].text}]
            </button>
            . The resulting portfolio profile is{" "}
            <button
              type="button"
              className={interactiveTagClasses(tokens[5].id)}
              onMouseEnter={() => setActiveEvidenceId(tokens[5].id)}
              onMouseLeave={() => setActiveEvidenceId(null)}
              onFocus={() => setActiveEvidenceId(tokens[5].id)}
              onBlur={() => setActiveEvidenceId(null)}
              onClick={() => setActiveEvidenceId((current) => (current === tokens[5].id ? null : tokens[5].id))}
            >
              [{tokens[5].text}]
            </button>
            , which supports the current final call.
          </p>
        </article>

        <article className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {widgets.map((widget) => {
            const isActive = activeEvidenceId === widget.id;
            const isDimmed = activeEvidenceId !== null && !isActive;

            return (
              <div
                key={widget.id}
                className={`rounded-2xl border p-4 transition-all ${
                  isActive
                    ? "scale-[1.02] border-primary bg-mint-light shadow-[0_0_0_1px_rgba(136,180,255,0.35),0_10px_25px_rgba(16,26,44,0.35)]"
                    : "border-white/8 bg-(--surface-container)"
                } ${isDimmed ? "opacity-45" : "opacity-100"}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{widget.label}</p>
                <p className="mt-1 text-lg font-bold text-strong">{widget.value}</p>
                <p className="mt-1 text-xs text-muted">{widget.detail}</p>
              </div>
            );
          })}
        </article>
      </div>
    </section>
  );
}
