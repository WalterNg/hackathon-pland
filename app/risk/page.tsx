"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "../components/auth/auth-guard";
import { AggregatedRiskAlertsSection } from "../components/risk/aggregated-risk-alerts-section";
import { GlobalRiskRulesDialog } from "../components/risk/global-risk-rules-dialog";
import { RiskAlertsSection } from "../components/risk/risk-alerts-section";
import { RiskHeader } from "../components/risk/risk-header";
import { Sidebar } from "../components/ui/sidebar";
import { useAggregatedRiskAlerts } from "../hooks/use-aggregated-risk-alerts";
import { useGlobalRiskRules } from "../hooks/use-global-risk-rules";
import { usePortfolios } from "../hooks/use-portfolios";
import { useRiskAlerts } from "../hooks/use-risk-alerts";
import { useRiskEvents } from "../hooks/use-risk-events";
import type { RiskAlertStatus } from "@/app/lib/risk-types";

const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";
const PAGE_ACTION_LABELS = {
  reviewAlerts: "Review active alerts",
  setGlobalRules: "Set global rules",
} as const;

function parseAlertStatus(value: string | null): RiskAlertStatus | "all" {
  if (value === "active" || value === "acknowledged" || value === "resolved") {
    return value;
  }

  return "all";
}

function RiskPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const alertsSectionRef = useRef<HTMLDivElement | null>(null);
  const [isGlobalRulesOpen, setGlobalRulesOpen] = useState(false);
  const portfolioName = searchParams.get("name")?.trim() || DEFAULT_PORTFOLIO_NAME;
  const alertStatus = parseAlertStatus(searchParams.get("status"));
  const focus = searchParams.get("focus");
  const isMainPortfolio = portfolioName === DEFAULT_PORTFOLIO_NAME;
  const aiHistoryHref = isMainPortfolio ? null : `/ai-history?name=${encodeURIComponent(portfolioName)}`;
  const { portfolios } = usePortfolios();
  const currentPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.name === portfolioName) ?? null,
    [portfolios, portfolioName]
  );
  const portfolioId = currentPortfolio?.id ?? null;
  const {
    events,
    alerts,
    isLoading: isRiskLoading,
    error: riskError,
    reload: reloadRiskEvents,
  } = useRiskEvents(portfolioId, portfolioName, undefined, !isMainPortfolio);
  const {
    alerts: alertCenterAlerts,
    isLoading: isAlertCenterLoading,
    isUpdatingId: updatingAlertId,
    error: alertCenterError,
    reload: reloadAlertCenter,
    acknowledge,
    resolve,
  } = useRiskAlerts(portfolioName, alertStatus, 15_000, !isMainPortfolio);
  const {
    summary: aggregatedSummary,
    groups: aggregatedGroups,
    isLoading: isAggregatedLoading,
    isUpdatingId: aggregatedUpdatingId,
    error: aggregatedError,
    acknowledge: acknowledgeAggregatedAlert,
    resolve: resolveAggregatedAlert,
  } = useAggregatedRiskAlerts(alertStatus, 15_000, isMainPortfolio);
  const {
    profile: globalRiskProfile,
    source: globalRiskRuleSource,
    isLoading: isGlobalRulesLoading,
    isSaving: isGlobalRulesSaving,
    error: globalRiskRulesError,
    save: saveGlobalRiskRules,
  } = useGlobalRiskRules(isMainPortfolio);
  const portfolioHref = `/portfolio?name=${encodeURIComponent(portfolioName)}`;
  const riskHref = `/risk?name=${encodeURIComponent(portfolioName)}`;

  const criticalActiveAlerts = useMemo(
    () => (isMainPortfolio ? aggregatedSummary.criticalActiveAlerts : alerts.filter((alert) => alert.status === "active" && alert.severity === "critical").length),
    [aggregatedSummary.criticalActiveAlerts, alerts, isMainPortfolio]
  );
  const warningActiveAlerts = useMemo(
    () => (isMainPortfolio ? aggregatedSummary.otherActiveAlerts : alerts.filter((alert) => alert.status === "active" && alert.severity !== "critical").length),
    [aggregatedSummary.otherActiveAlerts, alerts, isMainPortfolio]
  );
  const recentRiskEventsCount = isMainPortfolio ? aggregatedSummary.recentRiskEvents : events.length;

  const handleAcknowledgeAlert = useCallback(async (alertId: string) => {
    const ok = await acknowledge(alertId);
    if (!ok) {
      return false;
    }

    await Promise.all([reloadRiskEvents(), reloadAlertCenter()]);
    return true;
  }, [acknowledge, reloadAlertCenter, reloadRiskEvents]);

  const handleResolveAlert = useCallback(async (alertId: string) => {
    const ok = await resolve(alertId);
    if (!ok) {
      return false;
    }

    await Promise.all([reloadRiskEvents(), reloadAlertCenter()]);
    return true;
  }, [reloadAlertCenter, reloadRiskEvents, resolve]);

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        nextParams.delete(key);
        return;
      }

      nextParams.set(key, value);
    });

    if (!nextParams.get("name")) {
      nextParams.set("name", portfolioName);
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/risk?${nextQuery}` : "/risk");
  };

  const scrollToAlerts = () => {
    alertsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (focus === "alerts") {
      const frameId = window.requestAnimationFrame(() => {
        scrollToAlerts();
      });

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    if (focus === "rules" && isMainPortfolio) {
      setGlobalRulesOpen(true);
    }

    return undefined;
  }, [focus, isMainPortfolio]);

  return (
    <>
      <RiskHeader portfolioHref={portfolioHref} aiHistoryHref={aiHistoryHref} riskHref={riskHref} />

      <div className="app-shell flex overflow-hidden">
        <Sidebar portfolios={portfolios} sectionPath="/risk" />

        <main className="app-main overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-8 lg:px-8">
          <div className="content-shell max-w-7xl pb-6">
            <section className="mb-6 rounded-3xl border border-white/6 bg-(--surface-container-low) p-5 sm:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="typo-h1 text-strong">Risk Management</h1>
                    <span className="status-pill status-pill-neutral">{portfolioName}</span>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm text-muted">
                    {isMainPortfolio
                      ? "Review alerts across child portfolios and manage one global rule set from the main workspace."
                      : "Review alerts for this portfolio from a dedicated workspace. Global rules are managed only from Main Portfolio."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateSearchParams({ status: "active", focus: "alerts" });
                      scrollToAlerts();
                    }}
                    className="ui-button-secondary"
                  >
                    {PAGE_ACTION_LABELS.reviewAlerts}
                  </button>
                  {isMainPortfolio ? (
                    <button
                      type="button"
                      onClick={() => setGlobalRulesOpen(true)}
                      className="ui-button-primary"
                    >
                      {PAGE_ACTION_LABELS.setGlobalRules}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <article className="rounded-2xl border border-white/6 bg-(--surface-container) p-4">
                  <p className="typo-body-sm font-medium text-muted">Critical active alerts</p>
                  <p className="mt-2 text-[2rem] font-bold leading-none text-strong">{criticalActiveAlerts}</p>
                </article>
                <article className="rounded-2xl border border-white/6 bg-(--surface-container) p-4">
                  <p className="typo-body-sm font-medium text-muted">Other active alerts</p>
                  <p className="mt-2 text-[2rem] font-bold leading-none text-strong">{warningActiveAlerts}</p>
                </article>
                <article className="rounded-2xl border border-white/6 bg-(--surface-container) p-4">
                  <p className="typo-body-sm font-medium text-muted">Recent risk events</p>
                  <p className="mt-2 text-[2rem] font-bold leading-none text-strong">{recentRiskEventsCount}</p>
                </article>
              </div>

              {isMainPortfolio && aggregatedError ? <div className="panel-low mt-5 p-4 text-sm text-danger">{aggregatedError}</div> : null}
              {!isMainPortfolio && riskError ? <div className="panel-low mt-5 p-4 text-sm text-danger">{riskError}</div> : null}
            </section>

            <div ref={alertsSectionRef}>
              {isMainPortfolio ? (
                <AggregatedRiskAlertsSection
                  summary={aggregatedSummary}
                  groups={aggregatedGroups}
                  status={alertStatus}
                  isLoading={isAggregatedLoading}
                  isUpdatingId={aggregatedUpdatingId}
                  error={aggregatedError}
                  onStatusChange={(nextStatus) => updateSearchParams({ status: nextStatus, focus: "alerts" })}
                  onAcknowledge={acknowledgeAggregatedAlert}
                  onResolve={resolveAggregatedAlert}
                />
              ) : (
                <RiskAlertsSection
                  alerts={alertCenterAlerts}
                  status={alertStatus}
                  isLoading={isAlertCenterLoading}
                  isUpdatingId={updatingAlertId}
                  error={alertCenterError}
                  onStatusChange={(nextStatus) => updateSearchParams({ status: nextStatus, focus: "alerts" })}
                  onAcknowledge={handleAcknowledgeAlert}
                  onResolve={handleResolveAlert}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      <GlobalRiskRulesDialog
        open={isMainPortfolio && isGlobalRulesOpen}
        profile={globalRiskProfile}
        source={globalRiskRuleSource}
        isLoading={isGlobalRulesLoading}
        isSaving={isGlobalRulesSaving}
        error={globalRiskRulesError}
        onClose={() => setGlobalRulesOpen(false)}
        onSave={saveGlobalRiskRules}
      />
    </>
  );
}

export default function RiskPage() {
  return (
    <Suspense
      fallback={
        <div className="app-shell box-border overflow-hidden">
          <main className="app-main overflow-hidden px-4 pt-5 sm:px-6 lg:px-8">
            <div className="content-shell flex h-full min-h-0 flex-1 flex-col pb-6">
              <div className="panel-low p-5 text-sm text-muted">Loading risk workspace...</div>
            </div>
          </main>
        </div>
      }
    >
      <AuthGuard>
        <RiskPageContent />
      </AuthGuard>
    </Suspense>
  );
}
