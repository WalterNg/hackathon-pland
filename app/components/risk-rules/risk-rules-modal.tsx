"use client";

import { useEffect, useRef, useState } from "react";
import type { RiskProfile } from "@/app/lib/risk-types";
import type { RiskRulesFormValues } from "@/app/hooks/use-risk-rules-v2";

// ─── Rule field ───────────────────────────────────────────────────────────────

type FieldProps = {
  label: string;
  hint: string;
  unit: string;
  value: number | null;
  currentValue: number | null;
  onChange: (v: number | null) => void;
  disabled: boolean;
};

function RuleField({ label, hint, unit, value, currentValue, onChange, disabled }: FieldProps) {
  const isViolated = currentValue !== null && value !== null && currentValue > value;
  const pct = currentValue !== null && value !== null && value > 0
    ? Math.min(100, (currentValue / value) * 100)
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-strong">{label}</p>
          <p className="text-xs text-muted mt-0.5">{hint}</p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Input */}
          <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 w-32 transition-colors ${
            isViolated ? "border-danger/50 bg-danger/5" : "border-border bg-surface-low"
          }`}>
            <input
              type="number"
              min={0}
              step={unit === " USD" ? 10 : 0.5}
              className="w-full bg-transparent text-sm font-semibold text-strong focus:outline-none tabular-nums"
              value={value ?? ""}
              placeholder="—"
              disabled={disabled}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                onChange(Number.isNaN(raw) ? null : raw);
              }}
            />
            <span className="text-xs text-muted/60 shrink-0 select-none">{unit}</span>
          </div>

          {/* Status chip */}
          {value !== null && currentValue !== null ? (
            isViolated ? (
              <span className="flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-bold text-danger w-[76px] justify-center">
                <span className="material-icons-outlined text-[13px]">warning</span>
                Violated
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success w-[76px] justify-center">
                <span className="material-icons-outlined text-[13px]">check_circle</span>
                OK
              </span>
            )
          ) : (
            <span className="w-[76px]" />
          )}
        </div>
      </div>

      {/* Progress bar */}
      {value !== null && currentValue !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted/60">
            <span>Current: <span className={`font-semibold ${isViolated ? "text-danger" : "text-muted"}`}>{currentValue.toFixed(1)}{unit}</span></span>
            <span>Limit: {value.toFixed(1)}{unit}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-low overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isViolated ? "bg-danger" : "bg-success"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Active violations banner ─────────────────────────────────────────────────

type Violation = { label: string; current: number; limit: number; unit: string };

function ViolationBanner({ violations }: { violations: Violation[] }) {
  if (violations.length === 0) return null;
  return (
    <div className="rounded-xl border border-danger/25 bg-danger/5 p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-icons-outlined text-danger text-[16px]">warning</span>
        <p className="text-xs font-bold text-danger uppercase tracking-wide">
          {violations.length} Active Violation{violations.length > 1 ? "s" : ""}
        </p>
      </div>
      {violations.map((v, i) => (
        <p key={i} className="text-xs text-danger/80 flex items-start gap-1.5">
          <span className="material-icons-outlined text-[13px] mt-0.5 shrink-0">error_outline</span>
          <span>
            <strong>{v.label}</strong>: {v.current.toFixed(1)}{v.unit} exceeds limit of {v.limit.toFixed(1)}{v.unit}
          </span>
        </p>
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type Props = {
  isOpen: boolean;
  onClose: () => void;
  profile: RiskProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: (values: RiskRulesFormValues) => Promise<boolean>;
  currentMaxDrawdownPct: number | null;
  currentMaxPositionSizePct: number | null;
  currentDailyLossUsd: number | null;
};

export function RiskRulesModal({
  isOpen,
  onClose,
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
  const dialogRef = useRef<HTMLDivElement>(null);

  // Sync fields when profile loads or modal opens
  useEffect(() => {
    if (isOpen && profile) {
      setMaxDrawdownPct(profile.maxDrawdownPct ?? null);
      setMaxPositionSizePct(profile.maxPositionSizePct ?? null);
      setMaxDailyLossUsd(profile.maxDailyLossUsd ?? null);
    }
  }, [isOpen, profile]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  // Compute violations
  const violations: Violation[] = [];
  if (currentMaxDrawdownPct != null && maxDrawdownPct != null && currentMaxDrawdownPct > maxDrawdownPct)
    violations.push({ label: "Max Drawdown", current: currentMaxDrawdownPct, limit: maxDrawdownPct, unit: "%" });
  if (currentMaxPositionSizePct != null && maxPositionSizePct != null && currentMaxPositionSizePct > maxPositionSizePct)
    violations.push({ label: "Max Allocation per Coin", current: currentMaxPositionSizePct, limit: maxPositionSizePct, unit: "%" });
  if (currentDailyLossUsd != null && maxDailyLossUsd != null && currentDailyLossUsd > maxDailyLossUsd)
    violations.push({ label: "Max Daily Loss", current: currentDailyLossUsd, limit: maxDailyLossUsd, unit: " USD" });

  const handleSave = async () => {
    const ok = await onSave({ maxDrawdownPct, maxPositionSizePct, maxDailyLossUsd });
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => { setSaveSuccess(false); onClose(); }, 1200);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Configure Risk Rules"
        className="w-full max-w-lg rounded-2xl border border-border bg-panel shadow-2xl shadow-black/60 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <span className="material-icons-outlined text-primary text-[18px]">tune</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-strong">Configure Risk Rules</h2>
              <p className="text-xs text-muted mt-0.5">Set thresholds — alerts fire when breached</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-strong hover:bg-surface-low transition-colors"
            aria-label="Close"
          >
            <span className="material-icons-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {isLoading ? (
            <div className="space-y-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-surface-low" />
                  <div className="h-10 animate-pulse rounded-xl bg-surface-low" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <RuleField
                label="Max Drawdown"
                hint="Alert when portfolio value drops by this % from its peak"
                unit="%"
                value={maxDrawdownPct}
                currentValue={currentMaxDrawdownPct}
                onChange={setMaxDrawdownPct}
                disabled={isSaving}
              />
              <div className="h-px bg-border/60" />
              <RuleField
                label="Max Allocation per Coin"
                hint="Alert when any single asset exceeds this % of the portfolio"
                unit="%"
                value={maxPositionSizePct}
                currentValue={currentMaxPositionSizePct}
                onChange={setMaxPositionSizePct}
                disabled={isSaving}
              />
              <div className="h-px bg-border/60" />
              <RuleField
                label="Max Daily Loss"
                hint="Alert when intraday portfolio loss exceeds this USD amount"
                unit=" USD"
                value={maxDailyLossUsd}
                currentValue={currentDailyLossUsd}
                onChange={setMaxDailyLossUsd}
                disabled={isSaving}
              />
            </div>
          )}

          {/* Violations banner */}
          <ViolationBanner violations={violations} />

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-danger/5 border border-danger/20 p-3">
              <span className="material-icons-outlined text-danger text-sm">error</span>
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 gap-3">
          <p className="text-[11px] text-muted/60 flex items-center gap-1">
            <span className="material-icons-outlined text-[12px]">notifications_active</span>
            Rules are applied instantly on save
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:text-strong hover:bg-surface-low disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-all"
            >
              {isSaving ? (
                <>
                  <span className="material-icons-outlined text-[16px] animate-spin">sync</span>
                  Saving…
                </>
              ) : saveSuccess ? (
                <>
                  <span className="material-icons-outlined text-[16px]">check</span>
                  Saved!
                </>
              ) : (
                <>
                  <span className="material-icons-outlined text-[16px]">save</span>
                  Save Rules
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
