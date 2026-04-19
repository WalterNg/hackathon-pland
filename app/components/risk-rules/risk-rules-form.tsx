"use client";

import { useEffect, useState } from "react";
import type { RiskProfile } from "@/app/lib/risk-types";
import type { RiskRulesFormValues } from "@/app/hooks/use-risk-rules-v2";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type RuleFieldProps = {
  label: string;
  description: string;
  unit: string;
  value: number | null;
  currentValue: number | null;
  threshold: number | null;
  onChange: (val: number | null) => void;
  disabled: boolean;
};

function RuleField({
  label,
  description,
  unit,
  value,
  currentValue,
  threshold,
  onChange,
  disabled,
}: RuleFieldProps) {
  const isViolated =
    currentValue !== null && threshold !== null && currentValue > threshold;

  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-strong">{label}</p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
        {currentValue !== null && (
          <p className="text-xs mt-1">
            <span className="text-muted">Current: </span>
            <span
              className={`font-semibold ${isViolated ? "text-danger" : "text-muted"}`}
            >
              {currentValue.toFixed(1)}
              {unit}
            </span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-low px-3 py-2 w-28">
          <input
            type="number"
            min={0}
            step={0.5}
            className="w-full bg-transparent text-sm font-semibold text-strong focus:outline-none"
            value={value ?? ""}
            placeholder="—"
            disabled={disabled}
            onChange={(e) => {
              const raw = parseFloat(e.target.value);
              onChange(isNaN(raw) ? null : raw);
            }}
          />
          <span className="text-xs text-muted shrink-0">{unit}</span>
        </div>

        {isViolated ? (
          <span className="flex items-center gap-1 rounded-full bg-danger/10 px-2 py-1 text-xs font-semibold text-danger w-24 justify-center">
            <span className="material-icons-outlined text-sm">warning</span>
            Violated
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success w-24 justify-center">
            <span className="material-icons-outlined text-sm">check_circle</span>
            OK
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Violations list ──────────────────────────────────────────────────────────

type Violation = {
  label: string;
  currentValue: number;
  threshold: number;
  unit: string;
};

function ActiveViolations({ violations }: { violations: Violation[] }) {
  if (violations.length === 0) return null;

  return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold text-danger">
        <span className="material-icons-outlined text-base">warning</span>
        Active Violations ({violations.length})
      </p>
      {violations.map((v, i) => (
        <div
          key={i}
          className="flex items-center gap-2 text-xs text-danger/80"
        >
          <span className="material-icons-outlined text-sm">error_outline</span>
          <span>
            <strong>{v.label}:</strong> Current value is{" "}
            <strong>{v.currentValue.toFixed(1)}{v.unit}</strong>, exceeding
            threshold of <strong>{v.threshold.toFixed(1)}{v.unit}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  profile: RiskProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: (values: RiskRulesFormValues) => Promise<boolean>;
  // Live snapshot metrics for "current" display
  currentMaxDrawdownPct?: number | null;
  currentMaxPositionSizePct?: number | null;
  currentDailyLossUsd?: number | null;
};

export function RiskRulesForm({
  profile,
  isLoading,
  isSaving,
  error,
  onSave,
  currentMaxDrawdownPct,
  currentMaxPositionSizePct,
  currentDailyLossUsd,
}: Props) {
  const [maxDrawdownPct, setMaxDrawdownPct] = useState<number | null>(null);
  const [maxPositionSizePct, setMaxPositionSizePct] = useState<number | null>(null);
  const [maxDailyLossUsd, setMaxDailyLossUsd] = useState<number | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync fields when profile loads
  useEffect(() => {
    if (profile) {
      setMaxDrawdownPct(profile.maxDrawdownPct ?? null);
      setMaxPositionSizePct(profile.maxPositionSizePct ?? null);
      setMaxDailyLossUsd(profile.maxDailyLossUsd ?? null);
    }
  }, [profile]);

  const violations: Violation[] = [];
  if (currentMaxDrawdownPct != null && maxDrawdownPct != null && currentMaxDrawdownPct > maxDrawdownPct) {
    violations.push({ label: "Max Drawdown", currentValue: currentMaxDrawdownPct, threshold: maxDrawdownPct, unit: "%" });
  }
  if (currentMaxPositionSizePct != null && maxPositionSizePct != null && currentMaxPositionSizePct > maxPositionSizePct) {
    violations.push({ label: "Max Allocation per Coin", currentValue: currentMaxPositionSizePct, threshold: maxPositionSizePct, unit: "%" });
  }
  if (currentDailyLossUsd != null && maxDailyLossUsd != null && currentDailyLossUsd > maxDailyLossUsd) {
    violations.push({ label: "Max Daily Loss", currentValue: currentDailyLossUsd, threshold: maxDailyLossUsd, unit: " USD" });
  }

  const handleSave = async () => {
    const ok = await onSave({ maxDrawdownPct, maxPositionSizePct, maxDailyLossUsd });
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  if (isLoading) {
    return (
      <div className="panel rounded-2xl p-6 space-y-4">
        <div className="h-5 w-40 animate-pulse rounded bg-surface-low" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-low" />
        ))}
      </div>
    );
  }

  return (
    <div className="panel rounded-2xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="material-icons-outlined text-primary text-xl">settings</span>
        <h2 className="text-base font-semibold text-strong">Risk Rules Configuration</h2>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
          Define Your Risk Thresholds
        </p>

        <RuleField
          label="Max Drawdown"
          description="Alert when portfolio drawdown exceeds this percentage"
          unit="%"
          value={maxDrawdownPct}
          currentValue={currentMaxDrawdownPct ?? null}
          threshold={maxDrawdownPct}
          onChange={setMaxDrawdownPct}
          disabled={isSaving}
        />
        <RuleField
          label="Max Allocation per Coin"
          description="Alert when any single asset exceeds this portfolio share"
          unit="%"
          value={maxPositionSizePct}
          currentValue={currentMaxPositionSizePct ?? null}
          threshold={maxPositionSizePct}
          onChange={setMaxPositionSizePct}
          disabled={isSaving}
        />
        <RuleField
          label="Max Daily Loss"
          description="Alert when intraday loss exceeds this USD amount"
          unit=" USD"
          value={maxDailyLossUsd}
          currentValue={currentDailyLossUsd ?? null}
          threshold={maxDailyLossUsd}
          onChange={setMaxDailyLossUsd}
          disabled={isSaving}
        />
      </div>

      {error && (
        <p className="text-xs text-danger flex items-center gap-1">
          <span className="material-icons-outlined text-sm">error</span>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        <span className="material-icons-outlined text-base">
          {isSaving ? "hourglass_empty" : saveSuccess ? "check" : "save"}
        </span>
        {isSaving ? "Saving…" : saveSuccess ? "Saved!" : "Save Rules"}
      </button>

      <ActiveViolations violations={violations} />
    </div>
  );
}
