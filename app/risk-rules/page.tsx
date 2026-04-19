"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "../components/auth/auth-guard";
import { AppTopNavigation } from "../components/ui/app-top-navigation";
import { Sidebar } from "../components/ui/sidebar";
import { RiskRulesConfig } from "../components/risk-rules/risk-rules-config";
import { AlertHistory } from "../components/risk-rules/alert-history";
import { usePortfolios } from "../hooks/use-portfolios";
import { usePortfolioSnapshot } from "../hooks/use-portfolio-snapshot";
import { useRiskRulesV2 } from "../hooks/use-risk-rules-v2";
import { useRiskAlertsV2 } from "../hooks/use-risk-alerts-v2";
import { fetchWithSupabaseAuth } from "../lib/supabase/authenticated-fetch";

const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";
const EVALUATE_COOLDOWN_MS = 30_000;

function useEvaluateOnSnapshot(
  portfolioName: string,
  snapshot: ReturnType<typeof usePortfolioSnapshot>["snapshot"]
) {
  const lastEvaluatedAtRef = useRef<number>(0);
  const snapshotIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!snapshot) return;

    const snapshotKey = snapshot.summary?.timestamp ?? null;
    if (snapshotKey === snapshotIdRef.current) return;

    const now = Date.now();
    if (now - lastEvaluatedAtRef.current < EVALUATE_COOLDOWN_MS) return;

    snapshotIdRef.current = snapshotKey;
    lastEvaluatedAtRef.current = now;

    void fetchWithSupabaseAuth("/api/risk-rules/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        portfolioName,
        snapshot: {
          metrics: {
            maxDrawdownPercent: snapshot.metrics?.maxDrawdownPercent ?? 0,
          },
          assets: (snapshot.assets ?? []).map((a) => ({
            symbol: a.symbol,
            allocationPercent: a.allocationPercent ?? 0,
          })),
          chart: (snapshot.chart ?? []).map((c) => ({
            totalValueUsd: c.totalValueUsd ?? 0,
          })),
        },
      }),
    }).catch(() => {});
  }, [portfolioName, snapshot]);
}

function formatPct(value: number | null): string {
  if (value === null) return "-";
  return `${value.toFixed(1)}%`;
}

function formatUsd(value: number | null): string {
  if (value === null) return "-";
  return `$${value.toFixed(0)}`;
}

function quickMetric(label: string, value: string) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}:</p>
      <p className="text-sm font-semibold text-strong">{value}</p>
    </div>
  );
}

function RiskRulesPageContent() {
  const searchParams = useSearchParams();
  const portfolioName = searchParams.get("name")?.trim() || DEFAULT_PORTFOLIO_NAME;
  const { portfolios } = usePortfolios();

  const currentPortfolio = useMemo(
    () => portfolios.find((p) => p.name === portfolioName) ?? null,
    [portfolios, portfolioName]
  );

  const portfolioHref = `/portfolio?name=${encodeURIComponent(portfolioName)}`;
  const riskRulesHref = `/risk-rules?name=${encodeURIComponent(portfolioName)}`;

  const { snapshot } = usePortfolioSnapshot(currentPortfolio?.id ?? null, portfolioName);

  const { profile, isLoading: rulesLoading, isSaving, error: rulesError, save, reload: reloadRules } =
    useRiskRulesV2(portfolioName);

  const {
    alerts,
    isLoading: alertsLoading,
    isUpdatingId,
    error: alertsError,
    reload: reloadAlerts,
    acknowledge,
    resolve,
  } = useRiskAlertsV2(portfolioName, "all", 15_000);

  useEvaluateOnSnapshot(portfolioName, snapshot);

  const reloadAll = useCallback(() => {
    setTimeout(() => reloadAlerts(), 1500);
  }, [reloadAlerts]);

  const currentMaxDrawdownPct = snapshot?.metrics?.maxDrawdownPercent ?? null;
  const currentMaxPositionSizePct = useMemo(() => {
    if (!snapshot?.assets?.length) return null;
    return Math.max(...snapshot.assets.map((a) => a.allocationPercent ?? 0));
  }, [snapshot]);
  const currentDailyLossUsd = useMemo(() => {
    const chart = snapshot?.chart ?? [];
    if (chart.length < 2) return null;
    const prev = chart[chart.length - 2]?.totalValueUsd ?? 0;
    const curr = chart[chart.length - 1]?.totalValueUsd ?? 0;
    return Math.max(0, prev - curr);
  }, [snapshot]);

  const handleSave = useCallback(
    async (values: Parameters<typeof save>[0]) => {
      const ok = await save(values);
      if (ok) {
        reloadRules();
        reloadAll();
      }
      return ok;
    },
    [save, reloadRules, reloadAll]
  );

  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="border-b border-border px-6 py-3">
          <AppTopNavigation portfolioHref={portfolioHref} riskRulesHref={riskRulesHref} />
        </header>

        <div className="flex flex-1">
          <Sidebar sectionPath="/risk-rules" />

          <main className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-5xl space-y-8 px-5 py-6 sm:px-8 sm:py-8">
              <section className="rounded-2xl border border-white/10 bg-white/[0.015] p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-strong">Risk Rules</h1>
                    <p className="mt-1 text-sm text-muted">
                      Configure thresholds for <span className="font-semibold text-body">{portfolioName}</span> and keep alerting proactive.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-accent">
                    <span className="material-icons-outlined text-sm">shield</span>
                    Protection is active
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                  {quickMetric("Current Drawdown", formatPct(currentMaxDrawdownPct))}
                  {quickMetric("Largest Allocation", formatPct(currentMaxPositionSizePct))}
                  {quickMetric("Daily Loss", formatUsd(currentDailyLossUsd))}
                </div>
              </section>

              <RiskRulesConfig
                profile={profile}
                isLoading={rulesLoading}
                isSaving={isSaving}
                error={rulesError}
                onSave={handleSave}
                currentMaxDrawdownPct={currentMaxDrawdownPct}
                currentMaxPositionSizePct={currentMaxPositionSizePct}
                currentDailyLossUsd={currentDailyLossUsd}
              />

              <section className="rounded-2xl border border-white/10 bg-white/[0.015] p-5 sm:p-6">
                <AlertHistory
                  alerts={alerts}
                  isLoading={alertsLoading}
                  isUpdatingId={isUpdatingId}
                  error={alertsError}
                  onAcknowledge={acknowledge}
                  onResolve={resolve}
                />
              </section>
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

export default function RiskRulesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <span className="text-muted text-sm">Loading...</span>
        </div>
      }
    >
      <RiskRulesPageContent />
    </Suspense>
  );
}
