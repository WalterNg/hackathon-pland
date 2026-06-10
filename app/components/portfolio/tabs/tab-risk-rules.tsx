"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RiskMonitorAlerts } from "@/app/components/risk-rules/risk-monitor-alerts";
import { RiskMonitorRules } from "@/app/components/risk-rules/risk-monitor-rules";
import { usePortfolioSnapshot } from "@/app/hooks/use-portfolio-snapshot";
import { useRiskRulesV2 } from "@/app/hooks/use-risk-rules-v2";
import { useRiskAlertsV2 } from "@/app/hooks/use-risk-alerts-v2";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

const EVALUATE_COOLDOWN_MS = 30_000;

type InnerTab = "alerts" | "rules";

function useEvaluateOnSnapshot(
  portfolioName: string,
  snapshot: ReturnType<typeof usePortfolioSnapshot>["snapshot"]
) {
  const lastEvaluatedAtRef = useRef<number>(0);
  const snapshotIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!snapshot) return;
    const key = snapshot.summary?.timestamp ?? null;
    if (key === snapshotIdRef.current) return;
    const now = Date.now();
    if (now - lastEvaluatedAtRef.current < EVALUATE_COOLDOWN_MS) return;
    snapshotIdRef.current = key;
    lastEvaluatedAtRef.current = now;

    void fetchWithSupabaseAuth("/api/risk-rules/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        portfolioName,
        snapshot: {
          metrics: { maxDrawdownPercent: snapshot.metrics?.maxDrawdownPercent ?? 0 },
          assets: (snapshot.assets ?? []).map((a) => ({ symbol: a.symbol, allocationPercent: a.allocationPercent ?? 0 })),
          chart: (snapshot.chart ?? []).map((c) => ({ totalValueUsd: c.totalValueUsd ?? 0 })),
        },
      }),
    }).catch(() => {});
  }, [portfolioName, snapshot]);
}

type TabRiskRulesProps = {
  portfolioName: string;
  portfolioId: string | null;
};

export function TabRiskRules({ portfolioName, portfolioId }: TabRiskRulesProps) {
  const [activeTab, setActiveTab] = useState<InnerTab>("alerts");

  const { snapshot } = usePortfolioSnapshot(portfolioId, portfolioName);

  const { profile, isLoading: rulesLoading, isSaving, error: rulesError, save, reload: reloadRules } =
    useRiskRulesV2(portfolioName);

  const {
    alerts, isLoading: alertsLoading, isUpdatingId, error: alertsError,
    reload: reloadAlerts, acknowledge, resolve, override, revokeOverride, snooze, cancelSnooze,
  } = useRiskAlertsV2(portfolioName, "all", 15_000);

  useEvaluateOnSnapshot(portfolioName, snapshot);

  const reloadAll = useCallback(() => { setTimeout(() => reloadAlerts(), 1500); }, [reloadAlerts]);

  const currentMaxDrawdownPct = snapshot?.metrics?.maxDrawdownPercent ?? null;
  const currentMaxPositionSizePct = useMemo(() => {
    if (!snapshot?.assets?.length) return null;
    return Math.max(...snapshot.assets.map((a) => a.allocationPercent ?? 0));
  }, [snapshot]);
  const currentDailyLossUsd = useMemo(() => {
    const chart = snapshot?.chart ?? [];
    if (chart.length < 2) return null;
    return Math.max(0, (chart[chart.length - 2]?.totalValueUsd ?? 0) - (chart[chart.length - 1]?.totalValueUsd ?? 0));
  }, [snapshot]);

  const handleSave = useCallback(async (values: Parameters<typeof save>[0]) => {
    const ok = await save(values);
    if (ok) { reloadRules(); reloadAll(); }
    return ok;
  }, [save, reloadRules, reloadAll]);

  const activeAlertCount = alerts.filter((a) => a.status === "active").length;
  const criticalCount = alerts.filter((a) => a.status === "active" && a.severity === "critical").length;
  const activeRulesCount = [profile?.maxDrawdownPct, profile?.maxPositionSizePct, profile?.maxDailyLossUsd]
    .filter((v) => v !== null && v !== undefined).length;
  const liveRulesCount = 3;

  return (
    <>
      {/* ── Page header ── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-strong">Risk Monitor</h2>
          <p className="mt-1 text-sm text-muted">Live monitoring active</p>
        </div>
        <div className="flex items-center gap-2">
          {activeAlertCount > 0 && (
            <div className={`rounded-xl border px-3 py-1.5 text-center ${criticalCount > 0 ? "border-red-500/30 bg-red-500/8 text-red-300" : "border-amber-400/30 bg-amber-400/8 text-amber-300"}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">Alerts</p>
              <p className="text-sm font-semibold tabular-nums">{activeAlertCount} active</p>
            </div>
          )}
          <div className="rounded-xl border border-white/8 bg-white/2 px-3 py-1.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Rules on</p>
            <p className="text-sm font-semibold tabular-nums text-strong">{activeRulesCount} / {liveRulesCount}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/6 px-3 py-1.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/60">Live</p>
            <p className="text-sm font-semibold tabular-nums text-emerald-400">{liveRulesCount} monitoring</p>
          </div>
        </div>
      </div>

      {/* ── Inner tabs (Alerts / Rules) ── */}
      <div className="mb-6 flex border-b border-white/8">
        <button
          type="button"
          onClick={() => setActiveTab("alerts")}
          className={`flex items-center gap-2 border-b-2 px-1 pb-3 pr-5 text-sm font-semibold transition-colors ${
            activeTab === "alerts" ? "border-white text-strong" : "border-transparent text-muted hover:text-strong"
          }`}
        >
          Alerts
          {activeAlertCount > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              criticalCount > 0 ? "bg-red-500/20 text-red-300" : "bg-amber-400/20 text-amber-300"
            }`}>
              {activeAlertCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-2 border-b-2 px-1 pb-3 pr-5 text-sm font-semibold transition-colors ${
            activeTab === "rules" ? "border-white text-strong" : "border-transparent text-muted hover:text-strong"
          }`}
        >
          Rules
        </button>
      </div>

      {/* ── Tab content ── */}
      {activeTab === "alerts" && (
        <RiskMonitorAlerts
          alerts={alerts}
          isLoading={alertsLoading}
          isUpdatingId={isUpdatingId}
          error={alertsError}
          onAcknowledge={acknowledge}
          onResolve={resolve}
          onOverride={override}
          onRevokeOverride={revokeOverride}
          onSnooze={snooze}
          onCancelSnooze={cancelSnooze}
        />
      )}
      {activeTab === "rules" && (
        <RiskMonitorRules
          profile={profile}
          isLoading={rulesLoading}
          isSaving={isSaving}
          error={rulesError}
          onSave={handleSave}
          currentMaxDrawdownPct={currentMaxDrawdownPct}
          currentMaxPositionSizePct={currentMaxPositionSizePct}
          currentDailyLossUsd={currentDailyLossUsd}
        />
      )}
    </>
  );
}
