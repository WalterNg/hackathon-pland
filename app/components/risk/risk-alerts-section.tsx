"use client";

import type { RiskAlertRecord, RiskAlertStatus } from "@/app/lib/risk-types";
import type { OverridePayload } from "@/app/hooks/use-risk-alerts-v2";
import { RiskAlertList, riskAlertFilters } from "./risk-alert-list";

type RiskAlertsSectionProps = {
  alerts: RiskAlertRecord[];
  status: RiskAlertStatus | "all";
  isLoading: boolean;
  isUpdatingId: string | null;
  error: string | null;
  onStatusChange: (status: RiskAlertStatus | "all") => void;
  onAcknowledge: (alertId: string) => Promise<boolean>;
  onResolve: (alertId: string) => Promise<boolean>;
  onOverride?: (alertId: string, payload: OverridePayload) => Promise<boolean>;
  onRevokeOverride?: (alertId: string) => Promise<boolean>;
  onSnooze?: (alertId: string, minutes: number) => Promise<boolean>;
  onCancelSnooze?: (alertId: string) => Promise<boolean>;
};

export function RiskAlertsSection({
  alerts,
  status,
  isLoading,
  isUpdatingId,
  error,
  onStatusChange,
  onAcknowledge,
  onResolve,
  onOverride,
  onRevokeOverride,
  onSnooze,
  onCancelSnooze,
}: RiskAlertsSectionProps) {
  return (
    <section className="panel-base rounded-3xl p-5 sm:p-6" aria-labelledby="risk-alerts-heading">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 id="risk-alerts-heading" className="section-title">Alert Center</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Review active breaches, acknowledge them, and resolve incidents once exposure or rules have been adjusted.
          </p>
        </div>
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

      {isLoading && <div className="panel-low p-4 text-sm text-muted">Loading alerts...</div>}
      {!isLoading && error && <div className="panel-low p-4 text-sm text-danger">{error}</div>}

      {!isLoading && !error && alerts.length === 0 && (
        <div className="panel-low p-8 text-center text-sm text-muted">No alerts match this filter.</div>
      )}

      {!isLoading && !error && alerts.length > 0 && (
        <RiskAlertList
          alerts={alerts}
          isUpdatingId={isUpdatingId}
          onAcknowledge={onAcknowledge}
          onResolve={onResolve}
          onOverride={onOverride}
          onRevokeOverride={onRevokeOverride}
          onSnooze={onSnooze}
          onCancelSnooze={onCancelSnooze}
        />
      )}
    </section>
  );
}
