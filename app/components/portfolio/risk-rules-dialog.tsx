"use client";

import { useEffect, useMemo, useState } from "react";
import { MaterialIcon } from "../dashboard/material-icon";
import type { RiskProfile, RiskRulesFormValues, RiskRuleSource } from "@/app/lib/risk-types";

type RiskRulesDialogProps = {
  open: boolean;
  portfolioName: string;
  profile: RiskProfile | null;
  source: RiskRuleSource;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: RiskRulesFormValues) => Promise<void>;
};

type Preset = {
  id: string;
  label: string;
  description: string;
  values: RiskRulesFormValues;
};

const presets: Preset[] = [
  {
    id: "conservative",
    label: "Conservative",
    description: "Tight drawdown cap and smaller position sizing.",
    values: {
      maxDrawdownPct: 12,
      maxPositionSizePct: 15,
      maxDailyLossUsd: 250,
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Default profile for disciplined spot accumulation.",
    values: {
      maxDrawdownPct: 18,
      maxPositionSizePct: 22,
      maxDailyLossUsd: 500,
    },
  },
  {
    id: "aggressive",
    label: "Aggressive",
    description: "Higher tolerance for concentration and short-term swings.",
    values: {
      maxDrawdownPct: 25,
      maxPositionSizePct: 30,
      maxDailyLossUsd: 900,
    },
  },
];

function toFieldValue(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "" : `${value}`;
}

function parseFieldValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function RiskRulesDialog({
  open,
  portfolioName,
  profile,
  source,
  isLoading,
  isSaving,
  error,
  onClose,
  onSave,
}: RiskRulesDialogProps) {
  const [maxDrawdownPct, setMaxDrawdownPct] = useState("");
  const [maxPositionSizePct, setMaxPositionSizePct] = useState("");
  const [maxDailyLossUsd, setMaxDailyLossUsd] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setMaxDrawdownPct(toFieldValue(profile?.maxDrawdownPct));
    setMaxPositionSizePct(toFieldValue(profile?.maxPositionSizePct));
    setMaxDailyLossUsd(toFieldValue(profile?.maxDailyLossUsd));
  }, [open, profile]);

  const values = useMemo<RiskRulesFormValues>(() => ({
    maxDrawdownPct: parseFieldValue(maxDrawdownPct),
    maxPositionSizePct: parseFieldValue(maxPositionSizePct),
    maxDailyLossUsd: parseFieldValue(maxDailyLossUsd),
  }), [maxDailyLossUsd, maxDrawdownPct, maxPositionSizePct]);

  if (!open) {
    return null;
  }

  const handlePreset = (preset: Preset) => {
    setMaxDrawdownPct(toFieldValue(preset.values.maxDrawdownPct));
    setMaxPositionSizePct(toFieldValue(preset.values.maxPositionSizePct));
    setMaxDailyLossUsd(toFieldValue(preset.values.maxDailyLossUsd));
  };

  const handleSave = async () => {
    await onSave(values);
  };

  return (
    <div className="modal-backdrop z-95">
      <div className="modal-shell max-w-3xl p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-strong">Risk Rules</h2>
            <p className="mt-1 text-sm text-muted">Tune guardrails for {portfolioName} without leaving the portfolio workflow.</p>
          </div>

          <button type="button" onClick={onClose} className="icon-button h-10 w-10" aria-label="Close risk rules">
            <MaterialIcon name="close" outlined={false} className="text-xl" />
          </button>
        </div>

        <div className="mb-5 rounded-2xl bg-(--surface-container-low) p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-strong">Rule source</p>
              <p className="mt-1 text-sm text-muted">
                {source === "global" && "This portfolio is currently inheriting global rules. Saving here will create a portfolio override."}
                {source === "portfolio" && "These rules are portfolio-specific and will override any global fallback."}
                {source === "none" && "No rules are active yet. Choose a preset or enter custom thresholds."}
              </p>
            </div>
            <span className="status-pill status-pill-neutral capitalize">{source}</span>
          </div>
        </div>

        <div className="mb-5 grid gap-3 lg:grid-cols-3">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePreset(preset)}
              className="rounded-2xl bg-(--surface-container-low) p-4 text-left transition-colors hover:bg-(--surface-container-highest)"
            >
              <div className="text-sm font-semibold text-strong">{preset.label}</div>
              <div className="mt-1 text-sm text-muted">{preset.description}</div>
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="field-label">Max Drawdown %</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={maxDrawdownPct}
              onChange={(event) => setMaxDrawdownPct(event.target.value)}
              placeholder="e.g. 18"
              className="field-input"
            />
            <p className="mt-2 text-xs text-muted">Trigger when portfolio drawdown exceeds this threshold.</p>
          </div>

          <div>
            <label className="field-label">Max Position Size %</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={maxPositionSizePct}
              onChange={(event) => setMaxPositionSizePct(event.target.value)}
              placeholder="e.g. 22"
              className="field-input"
            />
            <p className="mt-2 text-xs text-muted">Flag concentration when a single coin becomes too large.</p>
          </div>

          <div>
            <label className="field-label">Max Daily Loss USD</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={maxDailyLossUsd}
              onChange={(event) => setMaxDailyLossUsd(event.target.value)}
              placeholder="e.g. 500"
              className="field-input"
            />
            <p className="mt-2 text-xs text-muted">Use an absolute USD limit to cap daily downside.</p>
          </div>
        </div>

        {isLoading && <div className="panel-low mt-5 p-3 text-sm text-muted">Loading current rules...</div>}
        {error && <div className="panel-low mt-5 p-3 text-sm text-danger">{error}</div>}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isSaving} className="ui-button-secondary disabled:opacity-60">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving} className="ui-button-primary disabled:opacity-60">
            {isSaving ? "Saving..." : "Save Rules"}
          </button>
        </div>
      </div>
    </div>
  );
}