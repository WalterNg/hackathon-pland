"use client";

import { useEffect, useState } from "react";
import type { RiskProfile } from "@/app/lib/risk-types";
import type { RiskRulesFormValues } from "@/app/hooks/use-risk-rules-v2";

const CMC = {
  blue: "#3861FB",
  green: "#16C784",
  amber: "#FFB86A",
  red: "#EA3943",
  redBg: "rgba(234,57,67,0.08)",
  redBorder: "rgba(234,57,67,0.24)",
  amberBg: "rgba(255,184,106,0.1)",
  amberBorder: "rgba(255,184,106,0.24)",
  greenBg: "rgba(22,199,132,0.1)",
  greenBorder: "rgba(22,199,132,0.24)",
  panelBg: "#1B1D2A",
  panelBorder: "rgba(255,255,255,0.08)",
  panelBorderStrong: "rgba(255,255,255,0.16)",
  labelText: "rgba(255,255,255,0.5)",
  mutedText: "rgba(255,255,255,0.68)",
};

type RuleStatus = "unset" | "breached" | "near" | "healthy" | "monitoring";

type RuleCardProps = {
  label: string;
  description: string;
  unit: string;
  value: number | null;
  currentValue: number | null;
  onChange: (v: number | null) => void;
  disabled: boolean;
};

function formatValue(value: number | null, unit: string): string {
  if (value === null) return "-";
  if (unit === "USD") return `$${value.toFixed(0)}`;
  return `${value.toFixed(1)}%`;
}

function getRuleStatus(value: number | null, currentValue: number | null): RuleStatus {
  if (value === null) return "unset";
  if (currentValue === null) return "monitoring";
  if (currentValue > value) return "breached";
  if (value > 0 && currentValue / value >= 0.85) return "near";
  return "healthy";
}

function statusTone(status: RuleStatus) {
  switch (status) {
    case "breached":
      return {
        text: "Breached",
        icon: "warning",
        color: CMC.red,
        bg: CMC.redBg,
        border: CMC.redBorder,
      };
    case "near":
      return {
        text: "Near Limit",
        icon: "error_outline",
        color: CMC.amber,
        bg: CMC.amberBg,
        border: CMC.amberBorder,
      };
    case "healthy":
      return {
        text: "Healthy",
        icon: "check_circle",
        color: CMC.green,
        bg: CMC.greenBg,
        border: CMC.greenBorder,
      };
    case "monitoring":
      return {
        text: "Monitoring",
        icon: "monitoring",
        color: "rgba(255,255,255,0.68)",
        bg: "rgba(255,255,255,0.06)",
        border: "rgba(255,255,255,0.14)",
      };
    default:
      return {
        text: "Not Set",
        icon: "do_not_disturb_on",
        color: "rgba(255,255,255,0.62)",
        bg: "rgba(255,255,255,0.06)",
        border: "rgba(255,255,255,0.14)",
      };
  }
}

function RuleCard({ label, description, unit, value, currentValue, onChange, disabled }: RuleCardProps) {
  const status = getRuleStatus(value, currentValue);
  const tone = statusTone(status);
  const isViolated = value !== null && currentValue !== null && currentValue > value;
  const utilizationPct =
    value !== null && currentValue !== null && value > 0 ? Math.min(100, (currentValue / value) * 100) : null;

  return (
    <div
      className="rounded-xl border px-4 py-4"
      style={{
        borderColor: isViolated ? CMC.redBorder : "rgba(255,255,255,0.12)",
        background: isViolated ? "rgba(234,57,67,0.04)" : "rgba(255,255,255,0.02)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-strong">{label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            color: tone.color,
            borderColor: tone.border,
            background: tone.bg,
          }}
        >
          <span className="material-icons-outlined text-sm">{tone.icon}</span>
          {tone.text}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(180px,230px)_1fr_1fr]">
        <label className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider" style={{ color: CMC.labelText }}>
            Limit
          </span>
          <div
            className="mt-1 flex items-center gap-2 border-b pb-1.5"
            style={{ borderColor: isViolated ? CMC.redBorder : "rgba(255,255,255,0.18)" }}
          >
            <input
              type="number"
              min={0}
              step={unit === "USD" ? 10 : 0.5}
              value={value ?? ""}
              placeholder="Set threshold"
              disabled={disabled}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                onChange(Number.isNaN(raw) ? null : raw);
              }}
              className="w-full bg-transparent text-base font-semibold tabular-nums text-strong focus:outline-none"
            />
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: CMC.labelText }}>
              {unit}
            </span>
          </div>
        </label>

        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: CMC.labelText }}>
            Current
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums text-strong">{formatValue(currentValue, unit)}</p>
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: CMC.labelText }}>
            Headroom
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums text-strong">
            {value !== null && currentValue !== null ? formatValue(Math.max(0, value - currentValue), unit) : "-"}
          </p>
        </div>
      </div>

      {utilizationPct !== null && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold" style={{ color: CMC.mutedText }}>
            <span>Utilization</span>
            <span>{Math.round(utilizationPct)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${utilizationPct}%`,
                background: isViolated ? CMC.red : utilizationPct >= 85 ? CMC.amber : CMC.green,
              }}
            />
          </div>
        </div>
      )}

      {isViolated && value !== null && currentValue !== null && (
        <p className="mt-3 text-xs font-medium" style={{ color: CMC.red }}>
          Breached by {formatValue(currentValue - value, unit)}. Consider reducing exposure or raising this limit.
        </p>
      )}
    </div>
  );
}

function metricCard(label: string, value: string) {
  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: CMC.labelText }}>
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-strong">{value}</p>
    </div>
  );
}

function nearlyEqual(a: number | null, b: number | null) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 0.0001;
}

type Violation = { label: string; current: number; limit: number; unit: string };

type Props = {
  profile: RiskProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: (values: RiskRulesFormValues) => Promise<boolean>;
  currentMaxDrawdownPct: number | null;
  currentMaxPositionSizePct: number | null;
  currentDailyLossUsd: number | null;
};

export function RiskRulesConfig({
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

  useEffect(() => {
    if (profile) {
      setMaxDrawdownPct(profile.maxDrawdownPct ?? null);
      setMaxPositionSizePct(profile.maxPositionSizePct ?? null);
      setMaxDailyLossUsd(profile.maxDailyLossUsd ?? null);
    }
  }, [profile]);

  const hasChanges = !(
    nearlyEqual(maxDrawdownPct, profile?.maxDrawdownPct ?? null) &&
    nearlyEqual(maxPositionSizePct, profile?.maxPositionSizePct ?? null) &&
    nearlyEqual(maxDailyLossUsd, profile?.maxDailyLossUsd ?? null)
  );

  const violations: Violation[] = [];
  if (maxDrawdownPct !== null && currentMaxDrawdownPct !== null && currentMaxDrawdownPct > maxDrawdownPct)
    violations.push({ label: "Max Drawdown", current: currentMaxDrawdownPct, limit: maxDrawdownPct, unit: "%" });
  if (maxPositionSizePct !== null && currentMaxPositionSizePct !== null && currentMaxPositionSizePct > maxPositionSizePct)
    violations.push({ label: "Max Allocation per Coin", current: currentMaxPositionSizePct, limit: maxPositionSizePct, unit: "%" });
  if (maxDailyLossUsd !== null && currentDailyLossUsd !== null && currentDailyLossUsd > maxDailyLossUsd)
    violations.push({ label: "Max Daily Loss", current: currentDailyLossUsd, limit: maxDailyLossUsd, unit: "USD" });

  const handleSave = async () => {
    const ok = await onSave({ maxDrawdownPct, maxPositionSizePct, maxDailyLossUsd });
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-20 animate-pulse rounded-xl bg-white/5" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  return (
    <section
      className="space-y-4 rounded-2xl border p-5 sm:p-6"
      style={{
        background: CMC.panelBg,
        borderColor: CMC.panelBorder,
        boxShadow: "0 20px 48px rgba(0, 0, 0, 0.24)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-strong">Risk Thresholds</h2>
          <p className="mt-1 text-sm text-muted">
            Define limits for drawdown, concentration, and intraday loss. Alerts trigger instantly when breached.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: CMC.panelBorderStrong, color: CMC.mutedText }}>
          <span className="material-icons-outlined text-sm">notifications_active</span>
          Live monitoring enabled
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {metricCard("Active Alerts", `${violations.length}`)}
        {metricCard("Rules Configured", `${[maxDrawdownPct, maxPositionSizePct, maxDailyLossUsd].filter((v) => v !== null).length} / 3`)}
        {metricCard("Save Status", saveSuccess ? "Saved" : hasChanges ? "Unsaved changes" : "Up to date")}
      </div>

      <div className="space-y-3">
        <RuleCard
          label="Max Drawdown"
          description="Alert when portfolio drawdown exceeds this percentage."
          unit="%"
          value={maxDrawdownPct}
          currentValue={currentMaxDrawdownPct}
          onChange={setMaxDrawdownPct}
          disabled={isSaving}
        />
        <RuleCard
          label="Max Allocation per Coin"
          description="Alert when any single asset concentration is too high."
          unit="%"
          value={maxPositionSizePct}
          currentValue={currentMaxPositionSizePct}
          onChange={setMaxPositionSizePct}
          disabled={isSaving}
        />
        <RuleCard
          label="Max Daily Loss"
          description="Alert when intraday loss exceeds this USD amount."
          unit="USD"
          value={maxDailyLossUsd}
          currentValue={currentDailyLossUsd}
          onChange={setMaxDailyLossUsd}
          disabled={isSaving}
        />
      </div>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-danger" style={{ borderColor: CMC.redBorder, background: CMC.redBg }}>
          <span className="material-icons-outlined text-sm">error</span>
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs" style={{ color: CMC.labelText }}>
          Changes are not applied until you save.
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45 hover:opacity-90"
          style={{ background: CMC.blue }}
        >
          {isSaving ? (
            <><span className="material-icons-outlined text-base animate-spin">sync</span>Saving...</>
          ) : saveSuccess ? (
            <><span className="material-icons-outlined text-base">check</span>Saved</>
          ) : (
            <><span className="material-icons-outlined text-base">save</span>Save Rules</>
          )}
        </button>
      </div>
    </section>
  );
}
