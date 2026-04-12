import type { RiskAlertRecord, RiskAlertStatus } from "@/app/lib/risk-types";

type RiskAlertListProps = {
  alerts: RiskAlertRecord[];
  isUpdatingId: string | null;
  onAcknowledge: (alertId: string) => Promise<boolean>;
  onResolve: (alertId: string) => Promise<boolean>;
};

const ALERT_ACTION_LABELS = {
  acknowledge: "Acknowledge",
  resolve: "Resolve",
  saving: "Saving...",
} as const;

export const riskAlertFilters: Array<{ value: RiskAlertStatus | "all"; label: string }> = [
  { value: "all", label: "All alerts" },
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

function formatLastTriggered(alert: RiskAlertRecord): string {
  const triggeredAt = new Date(alert.lastTriggeredAt).toLocaleString();
  if (alert.triggerCount <= 1) {
    return triggeredAt;
  }

  return `${triggeredAt} • ${alert.triggerCount} repeats`;
}

export function RiskAlertList({ alerts, isUpdatingId, onAcknowledge, onResolve }: RiskAlertListProps) {
  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <article
          key={alert.id}
          className={`rounded-2xl p-4 ${
            alert.severity === "critical" && alert.status === "active"
              ? "ui-surface-danger-soft"
              : "bg-(--surface-container-low)"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`status-pill ${severityClass(alert.severity)}`}>{alert.severity}</span>
                <span className={`status-pill ${statusClass(alert.status)}`}>{alert.status}</span>
                {alert.symbol ? <span className="status-pill status-pill-neutral">{alert.symbol.replace("USDT", "")}</span> : null}
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
                  {isUpdatingId === alert.id ? ALERT_ACTION_LABELS.saving : ALERT_ACTION_LABELS.acknowledge}
                </button>
              )}
              {alert.status !== "resolved" && (
                <button
                  type="button"
                  onClick={() => void onResolve(alert.id)}
                  disabled={isUpdatingId === alert.id}
                  className="ui-button-primary disabled:opacity-60"
                >
                  {isUpdatingId === alert.id ? ALERT_ACTION_LABELS.saving : ALERT_ACTION_LABELS.resolve}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            <div className="rounded-xl bg-(--surface-container) px-3 py-2">
              <span>Observed</span>
              <span className="ml-2 font-semibold text-strong">{formatObserved(alert)}</span>
            </div>
            <div className="rounded-xl bg-(--surface-container) px-3 py-2">
              <span>Threshold</span>
              <span className="ml-2 font-semibold text-strong">{formatThreshold(alert)}</span>
            </div>
            <div className="rounded-xl bg-(--surface-container) px-3 py-2">
              <span>Last triggered</span>
              <span className="ml-2 font-semibold text-strong">{formatLastTriggered(alert)}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}