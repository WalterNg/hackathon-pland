"use client";

import { MaterialIcon } from "../dashboard/material-icon";
import type { RiskAlertRecord, RiskAlertStatus } from "@/app/lib/risk-types";

type RiskAlertCenterDialogProps = {
  open: boolean;
  alerts: RiskAlertRecord[];
  status: RiskAlertStatus | "all";
  isLoading: boolean;
  isUpdatingId: string | null;
  error: string | null;
  onClose: () => void;
  onStatusChange: (status: RiskAlertStatus | "all") => void;
  onAcknowledge: (alertId: string) => Promise<void>;
  onResolve: (alertId: string) => Promise<void>;
};

const filters: Array<{ value: RiskAlertStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
];

function severityClass(severity: RiskAlertRecord["severity"]): string {
  if (severity === "critical") {
    return "bg-danger-soft text-danger";
  }

  if (severity === "warning") {
    return "bg-[rgba(255,184,106,0.14)] text-warning";
  }

  return "bg-info-soft text-info";
}

function statusClass(status: RiskAlertStatus): string {
  if (status === "active") {
    return "bg-danger-soft text-danger";
  }

  if (status === "acknowledged") {
    return "bg-[rgba(255,184,106,0.14)] text-warning";
  }

  return "bg-success-soft text-success";
}

function formatObserved(alert: RiskAlertRecord): string {
  if (alert.observedValue === null || !Number.isFinite(alert.observedValue)) {
    return "N/A";
  }

  if (alert.eventType.includes("daily_loss")) {
    return `${alert.observedValue.toFixed(2)} USD`;
  }

  return `${alert.observedValue.toFixed(2)}%`;
}

function formatThreshold(alert: RiskAlertRecord): string {
  if (alert.thresholdValue === null || !Number.isFinite(alert.thresholdValue)) {
    return "N/A";
  }

  if (alert.eventType.includes("daily_loss")) {
    return `${alert.thresholdValue.toFixed(2)} USD`;
  }

  return `${alert.thresholdValue.toFixed(2)}%`;
}

export function RiskAlertCenterDialog({
  open,
  alerts,
  status,
  isLoading,
  isUpdatingId,
  error,
  onClose,
  onStatusChange,
  onAcknowledge,
  onResolve,
}: RiskAlertCenterDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop z-95">
      <div className="modal-shell max-w-4xl p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-strong">Alert Center</h2>
            <p className="mt-1 text-sm text-muted">Review open breaches, acknowledge them, and keep a clean risk trail.</p>
          </div>

          <button type="button" onClick={onClose} className="icon-button h-10 w-10" aria-label="Close alert center">
            <MaterialIcon name="close" outlined={false} className="text-xl" />
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {filters.map((filter) => (
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
          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            {alerts.map((alert) => (
              <article key={alert.id} className="rounded-2xl bg-(--surface-container-low) p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`status-pill ${severityClass(alert.severity)}`}>{alert.severity}</span>
                      <span className={`status-pill ${statusClass(alert.status)}`}>{alert.status}</span>
                      {alert.symbol && <span className="status-pill status-pill-neutral">{alert.symbol.replace("USDT", "")}</span>}
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-strong">{alert.title}</h3>
                    <p className="mt-1 text-sm text-body">{alert.message}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {alert.status === "active" && (
                      <button
                        type="button"
                        onClick={() => void onAcknowledge(alert.id)}
                        disabled={isUpdatingId === alert.id}
                        className="ui-button-secondary disabled:opacity-60"
                      >
                        {isUpdatingId === alert.id ? "Saving..." : "Acknowledge"}
                      </button>
                    )}
                    {alert.status !== "resolved" && (
                      <button
                        type="button"
                        onClick={() => void onResolve(alert.id)}
                        disabled={isUpdatingId === alert.id}
                        className="ui-button-primary disabled:opacity-60"
                      >
                        {isUpdatingId === alert.id ? "Saving..." : "Resolve"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-muted md:grid-cols-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide">Observed</div>
                    <div className="mt-1 font-semibold text-strong">{formatObserved(alert)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide">Threshold</div>
                    <div className="mt-1 font-semibold text-strong">{formatThreshold(alert)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide">Triggered</div>
                    <div className="mt-1 font-semibold text-strong">{new Date(alert.lastTriggeredAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide">Count</div>
                    <div className="mt-1 font-semibold text-strong">{alert.triggerCount}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}