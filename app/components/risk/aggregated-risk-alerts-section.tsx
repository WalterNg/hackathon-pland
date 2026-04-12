"use client";

import type { AggregatedRiskAlertSummary, RiskAlertGroup, RiskAlertStatus } from "@/app/lib/risk-types";
import { RiskAlertList, riskAlertFilters } from "./risk-alert-list";

type AggregatedRiskAlertsSectionProps = {
  summary: AggregatedRiskAlertSummary;
  groups: RiskAlertGroup[];
  status: RiskAlertStatus | "all";
  isLoading: boolean;
  isUpdatingId: string | null;
  error: string | null;
  onStatusChange: (status: RiskAlertStatus | "all") => void;
  onAcknowledge: (alertId: string) => Promise<boolean>;
  onResolve: (alertId: string) => Promise<boolean>;
};

export function AggregatedRiskAlertsSection({
  summary,
  groups,
  status,
  isLoading,
  isUpdatingId,
  error,
  onStatusChange,
  onAcknowledge,
  onResolve,
}: AggregatedRiskAlertsSectionProps) {
  const hasChildPortfolios = summary.childPortfolioCount > 0;

  return (
    <section className="panel-base rounded-3xl p-5 sm:p-6" aria-labelledby="aggregated-risk-alerts-heading">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 id="aggregated-risk-alerts-heading" className="section-title">Child Portfolio Alerts</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Review alerts grouped by portfolio from one main workspace. Global rules are managed from Main Portfolio and apply across every child portfolio.
          </p>
        </div>

        <span className="status-pill status-pill-neutral">
          {summary.portfoliosWithAlerts}/{summary.childPortfolioCount} portfolios with alerts
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {riskAlertFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => onStatusChange(filter.value)}
            className={
              status === filter.value
                ? "status-pill bg-(--surface-bright) text-strong"
                : "status-pill status-pill-neutral"
            }
          >
            {filter.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="panel-low p-4 text-sm text-muted">Loading child portfolio alerts...</div>}
      {!isLoading && error && <div className="panel-low p-4 text-sm text-danger">{error}</div>}

      {!isLoading && !error && !hasChildPortfolios && (
        <div className="panel-low p-8 text-center text-sm text-muted">
          Create at least one child portfolio to monitor aggregated risk from Main Portfolio.
        </div>
      )}

      {!isLoading && !error && hasChildPortfolios && groups.length === 0 && (
        <div className="panel-low p-8 text-center text-sm text-muted">
          No child portfolio alerts match this filter.
        </div>
      )}

      {!isLoading && !error && groups.length > 0 && (
        <div className="space-y-5">
          {groups.map((group) => (
            <article key={group.portfolioId} className="rounded-2xl border border-white/6 bg-(--surface-container) p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-strong">{group.portfolioName}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {group.activeAlertCount > 0
                      ? `${group.activeAlertCount} active alerts are still open for this portfolio.`
                      : "No active alerts are currently open for this portfolio."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="status-pill status-pill-neutral">{group.alerts.length} shown</span>
                  {group.activeCriticalCount > 0 ? (
                    <span className="status-pill bg-danger-soft text-danger">{group.activeCriticalCount} critical</span>
                  ) : null}
                </div>
              </div>

              <RiskAlertList
                alerts={group.alerts}
                isUpdatingId={isUpdatingId}
                onAcknowledge={onAcknowledge}
                onResolve={onResolve}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}