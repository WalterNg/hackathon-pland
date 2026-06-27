"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RiskProfile } from "@/app/lib/risk-types";
import type { RiskRulesFormValues } from "@/app/hooks/use-risk-rules-v2";

// ─── Rule definitions ─────────────────────────────────────────────────────────

type RuleCategory = "portfolio" | "position" | "daily" | "advanced";

type RuleDef = {
  key: keyof RiskRulesFormValues | "maxLeverage" | "riskPerTradePct";
  profileKey?: keyof RiskProfile;
  category: RuleCategory;
  label: string;
  description: string;
  tooltip: string;
  unit: "%"| "USD" | "x" | "";
  max: number;
  step: number;
  live: boolean;  // actually evaluated by backend
  getCurrentValue?: (drawdown: number | null, position: number | null, daily: number | null) => number | null;
};

const RULE_DEFS: RuleDef[] = [
  {
    key: "maxDrawdownPct", profileKey: "maxDrawdownPct",
    category: "portfolio", label: "Max drawdown", description: "Portfolio decline from peak",
    tooltip: "Measures the largest percentage decline from a portfolio peak to the subsequent trough over the selected period.",
    unit: "%", max: 100, step: 0.5, live: true,
    getCurrentValue: (d) => d,
  },
  {
    key: "maxPositionSizePct", profileKey: "maxPositionSizePct",
    category: "position", label: "Max position size", description: "Single asset allocation cap",
    tooltip: "Measures the largest single asset as a % of total portfolio value.",
    unit: "%", max: 100, step: 0.5, live: true,
    getCurrentValue: (_, p) => p,
  },
  {
    key: "maxDailyLossUsd", profileKey: "maxDailyLossUsd",
    category: "daily", label: "Daily loss cap", description: "Max intraday loss in USD",
    tooltip: "Measures the USD loss from the portfolio's 00:00 UTC opening value to the current value. Alerts when that intraday loss exceeds the set USD cap.",
    unit: "USD", max: 10000, step: 10, live: true,
    getCurrentValue: (_, __, d) => d,
  },
  {
    key: "maxLeverage", profileKey: "maxLeverage",
    category: "portfolio", label: "Max leverage", description: "Portfolio leverage ceiling",
    tooltip: "Caps the portfolio's total leverage ratio (total exposure / equity). E.g. 2x means you're controlling twice your actual capital.",
    unit: "x", max: 10, step: 0.1, live: false,
  },
  {
    key: "riskPerTradePct", profileKey: "riskPerTradePct",
    category: "position", label: "Risk per trade", description: "Capital at risk per position",
    tooltip: "Limits the % of capital at risk on any single trade, calculated as the distance from entry to stop-loss relative to total portfolio size.",
    unit: "%", max: 20, step: 0.5, live: false,
  },
  // UI-only placeholders — no backend evaluation yet
  { key: "maxDrawdownPct", category: "advanced", label: "Volatility 7d", description: "Rolling 7-day volatility", tooltip: "Annualized price volatility of the portfolio over the last 7 days. A high value indicates unusually large swings in portfolio value.", unit: "%", max: 100, step: 1, live: false },
  { key: "maxDrawdownPct", category: "advanced", label: "Min Sharpe 30d", description: "Risk-adjusted return floor", tooltip: "Risk-adjusted return over 30 days. A Sharpe ratio below 1 means the returns don't adequately compensate for the risk being taken.", unit: "", max: 3, step: 0.1, live: false },
  { key: "maxDrawdownPct", category: "position", label: "Unrealized loss", description: "Open position loss limit", tooltip: "Total unrealized loss across all open positions as a % of portfolio. Alerts when floating losses exceed this threshold before any position is closed.", unit: "%", max: 100, step: 0.5, live: false },
  { key: "maxDrawdownPct", category: "portfolio", label: "HHI concentration", description: "Portfolio diversification score", tooltip: "Herfindahl-Hirschman Index (0–10,000) measuring portfolio concentration. Higher = less diversified. HHI above 2,500 is considered highly concentrated.", unit: "", max: 10000, step: 100, live: false },
  { key: "maxDrawdownPct", category: "advanced", label: "Portfolio beta", description: "Market sensitivity cap", tooltip: "Measures how sensitive the portfolio is to overall market moves. Beta = 1 tracks the market; beta > 1 means the portfolio moves more than the market.", unit: "", max: 3, step: 0.1, live: false },
];

const CATEGORIES: Array<{ value: RuleCategory | "all"; label: string }> = [
  { value: "all",       label: "All rules" },
  { value: "portfolio", label: "Portfolio"  },
  { value: "position",  label: "Positions"  },
  { value: "daily",     label: "Daily"      },
  { value: "advanced",  label: "Advanced"   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVal(v: number | null, unit: string): string {
  if (v === null) return "—";
  if (unit === "USD") return `$${v.toFixed(0)}`;
  if (unit === "%")   return `${v.toFixed(1)}%`;
  if (unit === "x")   return `${v.toFixed(1)}x`;
  return v.toFixed(2);
}

function fmtSignedUsd(v: number | null): string {
  if (v === null) return "—";
  const sign = v >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

type Status = "breach" | "near" | "ok" | "off";

function getStatus(current: number | null, thresh: number | null, enabled: boolean): Status {
  if (!enabled || thresh === null) return "off";
  if (current === null) return "ok";
  const r = current / thresh;
  if (r >= 1) return "breach";
  if (r >= 0.8) return "near";
  return "ok";
}

const STATUS_STYLES: Record<Status, { pill: string; fill: string; rowBg: string; rowBorder: string }> = {
  breach: { pill: "border-red-500/40 bg-red-500/15 text-red-300",          fill: "#ef4444", rowBg: "bg-red-500/4",   rowBorder: "border-l-2 border-l-red-500/50" },
  near:   { pill: "border-amber-400/35 bg-amber-400/12 text-amber-300",     fill: "#f59e0b", rowBg: "bg-amber-400/2", rowBorder: "border-l-2 border-l-amber-400/35" },
  ok:     { pill: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400", fill: "#10b981", rowBg: "",                  rowBorder: "" },
  off:    { pill: "border-white/10 bg-white/5 text-muted",                  fill: "rgba(255,255,255,0.1)", rowBg: "",      rowBorder: "" },
};

// ─── Gauge row ────────────────────────────────────────────────────────────────

type GaugeRowProps = {
  def: RuleDef;
  thresh: number | null;
  enabled: boolean;
  currentValue: number | null;
  currentValueLabel?: string | null;
  currentValueToneClassName?: string;
  isSaving: boolean;
  isPlaceholder?: boolean;
  onToggle: () => void;
  onThresholdChange: (v: number | null) => void;
};

function GaugeRow({
  def,
  thresh,
  enabled,
  currentValue,
  currentValueLabel,
  currentValueToneClassName,
  isSaving,
  isPlaceholder,
  onToggle,
  onThresholdChange,
}: GaugeRowProps) {
  const status = getStatus(currentValue, thresh, enabled);
  const { pill, fill, rowBg, rowBorder } = STATUS_STYLES[status];
  const isBreaching = status === "breach";
  const breachAmount = isBreaching && currentValue !== null && thresh !== null
    ? `+${(currentValue - thresh).toFixed(1)}${def.unit === "USD" ? " USD" : def.unit || ""} over`
    : null;
  const currentPct = (currentValue !== null && def.max > 0) ? Math.min(100, (currentValue / def.max) * 100) : 0;

  // Local slider state — smooth drag without re-rendering parent on every tick
  const [sliderVal, setSliderVal] = useState<number>(thresh ?? 0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setSliderVal(thresh ?? 0); }, [thresh]);
  const limitPct = def.max > 0 ? Math.min(100, (sliderVal / def.max) * 100) : null;

  return (
    <div className={`grid grid-cols-[28px_1fr_48px] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/2.5 ${rowBg} ${rowBorder} ${!enabled && !isPlaceholder ? "opacity-45" : ""}`}>
      {/* Toggle */}
      {isPlaceholder ? (
        <div className="flex h-[14px] w-[26px] items-center justify-center">
          <div className="h-0.5 w-4 rounded bg-white/15" />
        </div>
      ) : (
        <button type="button" onClick={onToggle}
          className={`relative h-[14px] w-[26px] shrink-0 rounded-full border-none transition-colors ${enabled ? "bg-blue-500/80" : "bg-white/15"}`}>
          <div className={`absolute top-[2px] h-[10px] w-[10px] rounded-full bg-white transition-all ${enabled ? "left-[14px]" : "left-[2px]"}`} />
        </button>
      )}

      {/* Label + gauge */}
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-strong">{def.label}</span>
          <span className="group relative">
            <svg className="h-3 w-3 cursor-default text-white/25 transition-colors group-hover:text-white/55" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3a.875.875 0 1 1 0 1.75A.875.875 0 0 1 8 4zm-1 3h2v4.5H7V7z" />
            </svg>
            <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-white/10 bg-[#1a1a1f] px-3 py-2 text-[11px] leading-relaxed text-white/70 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-white/10" />
              {def.tooltip}
            </span>
          </span>
        </div>
        {/* Slider gauge — thumb IS the threshold */}
        <div className="space-y-1 pr-1">
          <div className="relative h-[6px]">
            <div className="absolute inset-0 rounded-full bg-white/8" />
            <div className="absolute left-0 top-0 h-full rounded-full transition-all"
              style={{ width: `${currentPct}%`, background: enabled && !isPlaceholder ? fill : "rgba(255,255,255,0.1)" }} />
            {!isPlaceholder && enabled ? (
              <input type="range" min={0} max={def.max} step={def.unit === "USD" ? def.step : 0.25}
                value={sliderVal} disabled={isSaving}
                onChange={(e) => setSliderVal(parseFloat(e.target.value))}
                onMouseUp={(e) => onThresholdChange(parseFloat((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => onThresholdChange(parseFloat((e.target as HTMLInputElement).value))}
                className="absolute inset-0 h-full w-full cursor-pointer"
                style={{ WebkitAppearance:"slider-horizontal", opacity:0, zIndex:10 }}
              />
            ) : null}
            {limitPct !== null && enabled && !isPlaceholder && (
              <div className="pointer-events-none absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                style={{ left: `${limitPct}%` }} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] tabular-nums ${currentValueToneClassName ?? "text-white/35"}`}>
              {currentValueLabel ?? fmtVal(currentValue, def.unit)}
            </span>
            {breachAmount && <span className="text-[10px] text-red-400/75">{breachAmount}</span>}
            <div className="ml-auto flex items-center gap-1">
              {!isPlaceholder && enabled ? (
                <>
                  <span className="text-[10px] text-white/25">limit</span>
                  <input
                    type="number" min={0} max={def.max} step={def.step}
                    value={sliderVal === 0 && thresh === null ? "" : sliderVal}
                    disabled={isSaving}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) { setSliderVal(v); onThresholdChange(v); }
                    }}
                    className="w-22 min-w-0 rounded-md border border-white/10 bg-white/4 px-1.5 py-0.5 text-center text-[11px] tabular-nums text-white/70 focus:border-white/20 focus:outline-none disabled:opacity-40"
                  />
                  {def.unit && <span className="text-[10px] text-white/25">{def.unit}</span>}
                </>
              ) : (
                <span className="text-[10px] text-white/20">—</span>
              )}
            </div>
          </div>
        </div>
      </div>



      {/* Status pill */}
      <span className={`relative rounded-full border px-2 py-0.5 text-center text-[10px] font-semibold ${pill}`}>
        {isBreaching && !isPlaceholder && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        )}
        {isPlaceholder ? "soon" : status}
      </span>
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
  currentMaxDrawdownPct: number | null;
  currentMaxPositionSizePct: number | null;
  currentDailyLossUsd: number | null;
  currentDailyNetPnlUsd: number | null;
};

type LocalState = {
  maxDrawdownPct: number | null;
  maxPositionSizePct: number | null;
  maxDailyLossUsd: number | null;
  maxLeverageEnabled: boolean;
  maxLeverage: number | null;
  riskPerTradeEnabled: boolean;
  riskPerTradePct: number | null;
};

export function RiskMonitorRules({
  profile, isLoading, isSaving, error, onSave,
  currentMaxDrawdownPct, currentMaxPositionSizePct, currentDailyLossUsd, currentDailyNetPnlUsd,
}: Props) {
  const [saveLabel, setSaveLabel] = useState<"idle" | "saved">("idle");
  const [local, setLocal] = useState<LocalState>({
    maxDrawdownPct: null, maxPositionSizePct: null, maxDailyLossUsd: null,
    maxLeverageEnabled: false, maxLeverage: null,
    riskPerTradeEnabled: false, riskPerTradePct: null,
  });

  useEffect(() => {
    if (profile) {
      setLocal({
        maxDrawdownPct:    profile.maxDrawdownPct ?? null,
        maxPositionSizePct: profile.maxPositionSizePct ?? null,
        maxDailyLossUsd:   profile.maxDailyLossUsd ?? null,
        maxLeverageEnabled: profile.maxLeverage !== null,
        maxLeverage:       profile.maxLeverage ?? null,
        riskPerTradeEnabled: profile.riskPerTradePct !== null,
        riskPerTradePct:   profile.riskPerTradePct ?? null,
      });
    }
  }, [profile]);

  const enabledMap: Record<string, boolean> = {
    "Max drawdown":     local.maxDrawdownPct !== null,
    "Max position size": local.maxPositionSizePct !== null,
    "Daily loss cap":   local.maxDailyLossUsd !== null,
    "Max leverage":     local.maxLeverageEnabled,
    "Risk per trade":   local.riskPerTradeEnabled,
  };

  const threshMap: Record<string, number | null> = {
    "Max drawdown":     local.maxDrawdownPct,
    "Max position size": local.maxPositionSizePct,
    "Daily loss cap":   local.maxDailyLossUsd,
    "Max leverage":     local.maxLeverage,
    "Risk per trade":   local.riskPerTradePct,
  };

  const currentMap: Record<string, number | null> = {
    "Max drawdown":     currentMaxDrawdownPct,
    "Max position size": currentMaxPositionSizePct,
    "Daily loss cap":   currentDailyLossUsd,
    "Max leverage":     null,
    "Risk per trade":   null,
  };

  const liveRules = RULE_DEFS.slice(0, 5); // DB-backed
  const placeholders = RULE_DEFS.slice(5);  // UI-only

  const visibleLive = liveRules;
  const visiblePlaceholder = placeholders;
  const dailyPnlToneClassName =
    currentDailyNetPnlUsd === null
      ? "text-white/35"
      : currentDailyNetPnlUsd >= 0
        ? "text-emerald-400"
        : "text-red-400";

  const breachCount = useMemo(() =>
    liveRules.filter((r) => getStatus(currentMap[r.label], threshMap[r.label], enabledMap[r.label] ?? false) === "breach").length,
    [local, currentMaxDrawdownPct, currentMaxPositionSizePct, currentDailyLossUsd]
  );

  const isDirty = useMemo(() => {
    const approxEq = (a: number | null, b: number | null) =>
      a === b || (a !== null && b !== null && Math.abs(a - b) < 0.001);
    if (!profile) {
      // No saved profile yet — dirty if user has enabled any rule
      return (
        local.maxDrawdownPct !== null ||
        local.maxPositionSizePct !== null ||
        local.maxDailyLossUsd !== null ||
        local.maxLeverageEnabled ||
        local.riskPerTradeEnabled
      );
    }
    return (
      !approxEq(local.maxDrawdownPct,     profile.maxDrawdownPct ?? null) ||
      !approxEq(local.maxPositionSizePct, profile.maxPositionSizePct ?? null) ||
      !approxEq(local.maxDailyLossUsd,    profile.maxDailyLossUsd ?? null) ||
      local.maxLeverageEnabled !== (profile.maxLeverage !== null && profile.maxLeverage !== undefined) ||
      !approxEq(local.maxLeverage,        profile.maxLeverage ?? null) ||
      local.riskPerTradeEnabled !== (profile.riskPerTradePct !== null && profile.riskPerTradePct !== undefined) ||
      !approxEq(local.riskPerTradePct,    profile.riskPerTradePct ?? null)
    );
  }, [local, profile]);

  const handleToggle = (label: string) => {
    if (saveLabel === "saved") setSaveLabel("idle");
    setLocal((prev) => {
      if (label === "Max drawdown")      return { ...prev, maxDrawdownPct: prev.maxDrawdownPct === null ? 10 : null };
      if (label === "Max position size") return { ...prev, maxPositionSizePct: prev.maxPositionSizePct === null ? 30 : null };
      if (label === "Daily loss cap")    return { ...prev, maxDailyLossUsd: prev.maxDailyLossUsd === null ? 500 : null };
      if (label === "Max leverage")      return { ...prev, maxLeverageEnabled: !prev.maxLeverageEnabled };
      if (label === "Risk per trade")    return { ...prev, riskPerTradeEnabled: !prev.riskPerTradeEnabled };
      return prev;
    });
  };

  const handleThreshChange = (label: string, v: number | null) => {
    if (saveLabel === "saved") setSaveLabel("idle");
    setLocal((prev) => {
      if (label === "Max drawdown")      return { ...prev, maxDrawdownPct: v };
      if (label === "Max position size") return { ...prev, maxPositionSizePct: v };
      if (label === "Daily loss cap")    return { ...prev, maxDailyLossUsd: v };
      if (label === "Max leverage")      return { ...prev, maxLeverage: v };
      if (label === "Risk per trade")    return { ...prev, riskPerTradePct: v };
      return prev;
    });
  };

  const handleSave = async () => {
    const ok = await onSave({
      maxDrawdownPct: local.maxDrawdownPct,
      maxPositionSizePct: local.maxPositionSizePct,
      maxDailyLossUsd: local.maxDailyLossUsd,
    });
    if (ok) { setSaveLabel("saved"); setTimeout(() => setSaveLabel("idle"), 2000); }
  };

  const handleReset = () => {
    if (!profile) {
      setLocal({
        maxDrawdownPct: null, maxPositionSizePct: null, maxDailyLossUsd: null,
        maxLeverageEnabled: false, maxLeverage: null,
        riskPerTradeEnabled: false, riskPerTradePct: null,
      });
      setSaveLabel("idle");
      return;
    }
    setLocal({
      maxDrawdownPct:     profile.maxDrawdownPct ?? null,
      maxPositionSizePct: profile.maxPositionSizePct ?? null,
      maxDailyLossUsd:    profile.maxDailyLossUsd ?? null,
      maxLeverageEnabled: profile.maxLeverage !== null,
      maxLeverage:        profile.maxLeverage ?? null,
      riskPerTradeEnabled: profile.riskPerTradePct !== null,
      riskPerTradePct:    profile.riskPerTradePct ?? null,
    });
    setSaveLabel("idle");
  };

  if (isLoading) {
    return <div className="space-y-2">{[0,1,2,3,4].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-3">
          {breachCount > 0 && (
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
              {breachCount} breach{breachCount !== 1 ? "es" : ""}
            </span>
          )}
          <div className="flex items-center gap-2">
            {isDirty && saveLabel !== "saved" && (
              <>
                <span className="flex items-center gap-1.5 text-[11px] text-amber-400/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
                  Unsaved changes
                </span>
                <button type="button" onClick={handleReset} disabled={isSaving}
                  className="rounded-xl border border-white/10 bg-white/3 px-3 py-1.5 text-xs font-medium text-white/40 transition-colors hover:border-white/18 hover:text-white/60 disabled:opacity-40">
                  Reset
                </button>
              </>
            )}
            <button type="button" onClick={handleSave} disabled={isSaving || (!isDirty && saveLabel !== "saved")}
              className={`rounded-xl border px-4 py-1.5 text-xs font-semibold transition-all disabled:cursor-default ${
                saveLabel === "saved"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : isDirty
                  ? "border-amber-400/35 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15"
                  : "border-white/10 bg-white/3 text-white/30"
              }`}>
              {isSaving ? "Saving…" : saveLabel === "saved" ? "Saved ✓" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-2 text-xs text-red-300">{error}</p>}

      {/* Rules panel */}
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/1.5">
        {/* Column headers */}
        <div className="grid grid-cols-[28px_1fr_48px] gap-3 border-b border-white/8 px-4 py-2">
          <div />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Rule</p>
          <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-muted">Status</p>
        </div>

        <div className="divide-y divide-white/6">
          {visibleLive.map((def) => (
            <GaugeRow
              key={def.label}
              def={def}
              thresh={threshMap[def.label] ?? null}
              enabled={enabledMap[def.label] ?? false}
              currentValue={currentMap[def.label] ?? null}
              currentValueLabel={def.label === "Daily loss cap" ? fmtSignedUsd(currentDailyNetPnlUsd) : null}
              currentValueToneClassName={def.label === "Daily loss cap" ? dailyPnlToneClassName : undefined}
              isSaving={isSaving}
              onToggle={() => handleToggle(def.label)}
              onThresholdChange={(v) => handleThreshChange(def.label, v)}
            />
          ))}
          {visiblePlaceholder.map((def) => (
            <GaugeRow
              key={def.label}
              def={def}
              thresh={null}
              enabled={false}
              currentValue={null}
              isSaving={false}
              isPlaceholder
              onToggle={() => {}}
              onThresholdChange={() => {}}
            />
          ))}
          {visibleLive.length === 0 && visiblePlaceholder.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">No rules in this category.</p>
          )}
        </div>
      </div>

    </div>
  );
}
