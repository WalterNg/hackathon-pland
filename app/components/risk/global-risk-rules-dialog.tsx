"use client";

import { useEffect, useMemo, useState } from "react";
import { MaterialIcon } from "../dashboard/material-icon";
import type { RiskProfile, RiskRulesFormValues, RiskRuleSource } from "@/app/lib/risk-types";

type GlobalRiskRulesDialogProps = {
  open: boolean;
  profile: RiskProfile | null;
  source: RiskRuleSource;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: RiskRulesFormValues) => Promise<boolean>;
};

type Preset = {
  id: string;
  label: string;
  description: string;
  values: RiskRulesFormValues;
};

const DIALOG_ACTION_LABELS = {
  title: "Set global rules",
  cancel: "Cancel",
  save: "Save global rules",
  saving: "Saving...",
} as const;

const presets: Preset[] = [
  {
    id: "conservative",
    label: "Conservative",
    description: "Tighter drawdown cap with smaller position concentration.",
    values: {
      maxDrawdownPct: 12,
      maxPositionSizePct: 15,
      maxDailyLossUsd: 250,
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Default profile for disciplined spot portfolios.",
    values: {
      maxDrawdownPct: 18,
      maxPositionSizePct: 22,
      maxDailyLossUsd: 500,
    },
  },
  {
    id: "aggressive",
    label: "Aggressive",
    description: "Higher tolerance for concentration and short swings.",
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

export function GlobalRiskRulesDialog({
  open,
  profile,
  source,
  isLoading,
  isSaving,
  error,
  onClose,
  onSave,
}: GlobalRiskRulesDialogProps) {
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
    const saved = await onSave(values);
    if (saved) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[rgba(3,5,10,0.72)] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-risk-rules-title"
    >
      <div className="modal-shell max-h-[96vh] w-full max-w-3xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <h2 id="global-risk-rules-title" className="text-[1.65rem] font-bold leading-none tracking-tight text-strong">
              {DIALOG_ACTION_LABELS.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              These guardrails apply across every child portfolio. Legacy portfolio-specific overrides are ignored by the runtime.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="icon-button h-10 w-10 transition-all duration-200 ease-out hover:scale-105 hover:bg-(--surface-bright)"
            aria-label="Close"
          >
            <MaterialIcon name="close" outlined={false} className="text-xl" />
          </button>
        </div>

        <div className="max-h-[calc(96vh-150px)] overflow-y-auto px-5 pt-1 pb-4 sm:px-6 sm:pt-2 sm:pb-5">
          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-(--surface-container-low) p-4">
            <div>
              <p className="text-sm font-semibold text-strong">Rule source</p>
              <p className="mt-1 text-sm text-muted">
                {source === "global" && "Global rules are active now and will be applied to every child portfolio."}
                {source === "none" && "No global rules are active yet. Choose a preset or define custom thresholds."}
                {source === "portfolio" && "Portfolio-specific rules are deprecated. Saving here replaces them with one global rule set."}
              </p>
            </div>

            <span className="status-pill status-pill-neutral capitalize">{source}</span>
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
              <p className="mt-2 text-xs text-muted">Trigger when drawdown exceeds this global threshold.</p>
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
              <p className="mt-2 text-xs text-muted">Flag concentration when one asset becomes too large.</p>
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
              <p className="mt-2 text-xs text-muted">Use an absolute daily downside cap for all child portfolios.</p>
            </div>
          </div>

          {isLoading && <div className="panel-low mt-5 p-3 text-sm text-muted">Loading current global rules...</div>}
          {error && <div className="panel-low mt-5 p-3 text-sm text-danger">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/6 px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="ui-button-secondary" disabled={isSaving}>
            {DIALOG_ACTION_LABELS.cancel}
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving} className="ui-button-primary disabled:opacity-60">
            {isSaving ? DIALOG_ACTION_LABELS.saving : DIALOG_ACTION_LABELS.save}
          </button>
        </div>
      </div>
    </div>
  );
}