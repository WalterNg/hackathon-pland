"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "../components/auth/auth-guard";
import { RiskAlertsSection } from "../components/risk/risk-alerts-section";
import { RiskHeader } from "../components/risk/risk-header";
import { RiskMonitorPanel } from "../components/risk/risk-monitor-panel";
import { RiskRulesSection } from "../components/risk/risk-rules-section";
import { Sidebar } from "../components/ui/sidebar";
import { usePortfolioSnapshot } from "../hooks/use-portfolio-snapshot";
import { usePortfolios } from "../hooks/use-portfolios";
import { useRiskManagementState } from "../hooks/use-risk-management-state";
import type { RiskAlertStatus } from "@/app/lib/risk-types";

const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";

function parseAlertStatus(value: string | null): RiskAlertStatus | "all" {
  if (value === "active" || value === "acknowledged" || value === "resolved") {
    return value;
  }

  return "all";
}

function RiskPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rulesSectionRef = useRef<HTMLDivElement | null>(null);
  const alertsSectionRef = useRef<HTMLDivElement | null>(null);
  const portfolioName = searchParams.get("name")?.trim() || DEFAULT_PORTFOLIO_NAME;
  const alertStatus = parseAlertStatus(searchParams.get("status"));
  const focus = searchParams.get("focus");
  const { portfolios } = usePortfolios();
  const currentPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.name === portfolioName) ?? null,
    [portfolios, portfolioName]
  );
  const portfolioId = currentPortfolio?.id ?? null;
  const {
    snapshot,
    isLoading: isSnapshotLoading,
    error: snapshotError,
  } = usePortfolioSnapshot(portfolioId, portfolioName);
  const portfolioHref = `/portfolio?name=${encodeURIComponent(portfolioName)}`;
  const riskHref = `/risk?name=${encodeURIComponent(portfolioName)}`;
  const {
    profile,
    events,
    alerts,
    isRiskLoading,
    riskError,
    editableRiskProfile,
    riskRuleSource,
    isRiskRulesLoading,
    isRiskRulesSaving,
    riskRulesError,
    alertCenterAlerts,
    isAlertCenterLoading,
    updatingAlertId,
    alertCenterError,
    handleSaveRiskRules,
    handleAcknowledgeAlert,
    handleResolveAlert,
  } = useRiskManagementState(portfolioId, portfolioName, alertStatus);
  const metrics = snapshot?.metrics ?? null;
  const monitorError = riskError ?? snapshotError;
  const isMonitorLoading = isRiskLoading || isSnapshotLoading;

  const criticalActiveAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === "active" && alert.severity === "critical"),
    [alerts]
  );
  const warningActiveAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === "active" && alert.severity !== "critical"),
    [alerts]
  );

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

  const scrollToSection = (section: "rules" | "alerts") => {
    const target = section === "rules" ? rulesSectionRef.current : alertsSectionRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (focus !== "rules" && focus !== "alerts") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollToSection(focus);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [focus]);

  return (
    <>
      <RiskHeader portfolioHref={portfolioHref} riskHref={riskHref} />

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
                    Manage alert triage and portfolio-specific risk rules from a dedicated workspace without cluttering the main portfolio screen.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateSearchParams({ status: "active", focus: "alerts" });
                      scrollToSection("alerts");
                    }}
                    className="ui-button-secondary"
                  >
                    Review active alerts
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateSearchParams({ focus: "rules" });
                      scrollToSection("rules");
                    }}
                    className="ui-button-primary"
                  >
                    Adjust rules
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <article className="rounded-2xl border border-white/6 bg-(--surface-container) p-4">
                  <p className="typo-body-sm font-medium text-muted">Critical active alerts</p>
                  <p className="mt-2 text-[2rem] font-bold leading-none text-strong">{criticalActiveAlerts.length}</p>
                </article>
                <article className="rounded-2xl border border-white/6 bg-(--surface-container) p-4">
                  <p className="typo-body-sm font-medium text-muted">Other active alerts</p>
                  <p className="mt-2 text-[2rem] font-bold leading-none text-strong">{warningActiveAlerts.length}</p>
                </article>
                <article className="rounded-2xl border border-white/6 bg-(--surface-container) p-4">
                  <p className="typo-body-sm font-medium text-muted">Recent risk events</p>
                  <p className="mt-2 text-[2rem] font-bold leading-none text-strong">{events.length}</p>
                </article>
              </div>

              {riskError && <div className="panel-low mt-5 p-4 text-sm text-danger">{riskError}</div>}

              {!riskError && !isRiskLoading && profile && (
                <div className="mt-5 rounded-2xl border border-white/6 bg-(--surface-container) p-4 text-sm text-body">
                  Active profile: <span className="font-semibold text-strong">{profile.name}</span>
                </div>
              )}
            </section>

            <RiskMonitorPanel
              metrics={metrics}
              events={events}
              alerts={alerts}
              isLoading={isMonitorLoading}
              error={monitorError}
              onViewAlerts={() => {
                updateSearchParams({ status: "active", focus: "alerts" });
                scrollToSection("alerts");
              }}
            />

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <div ref={rulesSectionRef}>
                <RiskRulesSection
                  portfolioName={portfolioName}
                  profile={editableRiskProfile}
                  source={riskRuleSource}
                  isLoading={isRiskRulesLoading}
                  isSaving={isRiskRulesSaving}
                  error={riskRulesError}
                  onSave={handleSaveRiskRules}
                />
              </div>

              <div ref={alertsSectionRef}>
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
              </div>
            </div>
          </div>
        </main>
      </div>
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