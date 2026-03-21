import type { PortfolioMetrics } from "@/app/lib/portfolio-types";
import type { RiskEventRecord, RiskProfile } from "@/app/lib/risk-types";

type RiskMonitorPanelProps = {
  metrics: PortfolioMetrics;
  profile: RiskProfile | null;
  events: RiskEventRecord[];
  isLoading: boolean;
  error: string | null;
};

function metricValue(value: number | null | undefined, suffix = "%"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(2)}${suffix}`;
}

function sharpeValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Preparing";
  }

  return value.toFixed(3);
}

function riskBand(score: number | null | undefined): { label: string; className: string } {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return { label: "Unknown", className: "bg-gray-100 text-muted" };
  }

  if (score >= 75) {
    return { label: "High", className: "bg-danger-soft text-danger" };
  }

  if (score >= 50) {
    return { label: "Medium", className: "bg-[rgba(255,184,106,0.14)] text-warning" };
  }

  return { label: "Low", className: "bg-success-soft text-success" };
}

function eventSeverityClass(severity: RiskEventRecord["severity"]): string {
  if (severity === "critical") {
    return "bg-danger-soft text-danger";
  }

  if (severity === "warning") {
    return "bg-orange-100 text-warning";
  }

  return "bg-info-soft text-info";
}

function eventMessage(event: RiskEventRecord): string {
  const fromDetails = event.details.message;
  if (typeof fromDetails === "string" && fromDetails.trim()) {
    return fromDetails;
  }

  return event.eventType.replaceAll("_", " ");
}

export function RiskMonitorPanel({ metrics, profile, events, isLoading, error }: RiskMonitorPanelProps) {
  const score = metrics.riskScore ?? null;
  const scoreBand = riskBand(score);

  return (
    <section className="panel-base mb-6 overflow-hidden p-5 sm:p-6 lg:mb-8" aria-live="polite">
      <div className="mb-6 flex items-start justify-between gap-3 border-b border-white/6 pb-4">
        <div>
          <h3 className="section-title">Risk Monitor</h3>
        </div>

        <span className={`status-pill ${scoreBand.className}`}>
          {scoreBand.label} Risk {score !== null ? `(${score.toFixed(1)})` : ""}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="rounded-2xl border border-white/6 bg-(--surface-container-low) px-4 py-4">
          <p className="typo-body-sm font-medium text-muted">Max Drawdown</p>
          <p className="mt-2 text-[2rem] font-bold leading-none text-strong">{metricValue(metrics.maxDrawdownPercent)}</p>
        </article>

        <article className="rounded-2xl border border-white/6 bg-(--surface-container-low) px-4 py-4">
          <p className="typo-body-sm font-medium text-muted">Volatility</p>
          <p className="mt-2 text-[2rem] font-bold leading-none text-strong">{metricValue(metrics.volatilityPercent)}</p>
        </article>

        <article className="rounded-2xl border border-white/6 bg-(--surface-container-low) px-4 py-4">
          <p className="typo-body-sm font-medium text-muted">Concentration (HHI)</p>
          <p className="mt-2 text-[2rem] font-bold leading-none text-strong">{metricValue(metrics.concentrationIndex, "")}</p>
        </article>

        <article className="rounded-2xl border border-white/6 bg-(--surface-container-low) px-4 py-4">
          <p className="typo-body-sm font-medium text-muted">Sharpe 30d</p>
          <p className="mt-2 text-[2rem] font-bold leading-none text-strong">{sharpeValue(metrics.sharpeRatio30d ?? null)}</p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <article className="rounded-2xl border border-white/6 bg-(--surface-container-low) px-4 py-4">
          <p className="typo-body mb-3 font-semibold text-strong">Active limits</p>

          {!profile && <p className="typo-body-xs text-muted">No active risk profile for this portfolio.</p>}

          {profile && (
            <div className="space-y-2 text-sm font-medium text-body">
              <p>Max drawdown: {profile.maxDrawdownPct !== null ? `${profile.maxDrawdownPct.toFixed(2)}%` : "Not set"}</p>
              <p>Max position size: {profile.maxPositionSizePct !== null ? `${profile.maxPositionSizePct.toFixed(2)}%` : "Not set"}</p>
              <p>Max daily loss: {profile.maxDailyLossUsd !== null ? `${profile.maxDailyLossUsd.toFixed(2)} USD` : "Not set"}</p>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-white/6 bg-(--surface-container-low) px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="typo-body font-semibold text-strong">Recent alerts</p>
            <span className="status-pill status-pill-neutral">
              {metrics.violatedRulesCount ?? events.length} active
            </span>
          </div>

          {isLoading && <p className="typo-body-xs text-muted">Loading risk alerts...</p>}
          {!isLoading && error && <p className="typo-body-xs text-danger">{error}</p>}

          {!isLoading && !error && events.length === 0 && (
            <p className="typo-body-xs text-muted">No recent risk events.</p>
          )}

          {!isLoading && !error && events.length > 0 && (
            <div className="space-y-2">
              {events.slice(0, 4).map((event) => (
                <div key={event.id} className="flex items-start gap-2 rounded-xl border border-white/6 bg-(--surface-container) p-3">
                  <span className={`status-pill ${eventSeverityClass(event.severity)}`}>
                    {event.severity}
                  </span>
                  <p className="typo-body-xs min-w-0 flex-1 text-body">{eventMessage(event)}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <div className="mt-4 border-t border-white/6 pt-4">
        <p className="typo-caption text-subtle">Last update: {metrics.lastRiskUpdatedAt ? new Date(metrics.lastRiskUpdatedAt).toLocaleString() : "N/A"}</p>
      </div>
    </section>
  );
}
