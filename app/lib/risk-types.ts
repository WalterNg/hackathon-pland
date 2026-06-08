export type RiskSeverity = "info" | "warning" | "critical";

export type RiskAlertStatus = "active" | "acknowledged" | "snoozed" | "overridden" | "resolved";

export type RiskRuleSource = "none" | "global" | "portfolio";

export type RiskProfile = {
  id: string;
  userId: string;
  portfolioId: string | null;
  name: string;
  maxDailyLossUsd: number | null;
  maxPositionSizePct: number | null;
  maxLeverage: number | null;
  maxDrawdownPct: number | null;
  riskPerTradePct: number | null;
  isActive: boolean;
  updatedAt: string;
};

export type RiskLimit = {
  id: string;
  riskProfileId: string;
  limitType: string;
  limitValue: number;
  isEnabled: boolean;
};

export type RiskMetricsSnapshot = {
  maxDrawdownPercent: number;
  volatilityPercent: number;
  concentrationIndex: number;
  sharpeRatio7d: number | null;
  sharpeRatio30d: number | null;
  sharpeRatio90d: number | null;
  riskScore: number;
};

export type RiskViolation = {
  eventType: string;
  severity: RiskSeverity;
  title: string;
  message: string;
  observedValue: number;
  thresholdValue: number | null;
  symbol?: string;
  signature: string;
  dedupKey: string;
};

export type RiskEventRecord = {
  id: string;
  eventType: string;
  severity: RiskSeverity;
  details: Record<string, unknown>;
  occurredAt: string;
};

export type RiskAlertRecord = {
  id: string;
  portfolioId: string | null;
  riskProfileId: string | null;
  eventType: string;
  severity: RiskSeverity;
  status: RiskAlertStatus;
  title: string;
  message: string;
  observedValue: number | null;
  thresholdValue: number | null;
  symbol?: string;
  signature: string;
  triggerCount: number;
  firstTriggeredAt: string;
  lastTriggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  // E1: override fields
  overrideReason: string | null;
  overrideExpiresAt: string | null;
  overrideValue: number | null;
  overrideAt: string | null;
  // E2: snooze
  snoozedUntil: string | null;
};

export const SNOOZE_OPTIONS: { label: string; minutes: number }[] = [
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
];

export type OverrideReason =
  | "Taking profit soon"
  | "Intentional overweight"
  | "Other";

export const OVERRIDE_DURATION_OPTIONS: { label: string; hours: number | null }[] = [
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
  { label: "Until I revoke manually", hours: null },
]
;

export type RiskAlertGroup = {
  portfolioId: string;
  portfolioName: string;
  activeCriticalCount: number;
  activeAlertCount: number;
  alerts: RiskAlertRecord[];
};

export type AggregatedRiskAlertSummary = {
  criticalActiveAlerts: number;
  otherActiveAlerts: number;
  recentRiskEvents: number;
  childPortfolioCount: number;
  portfoliosWithAlerts: number;
};

export type RiskRulesFormValues = {
  maxDrawdownPct: number | null;
  maxPositionSizePct: number | null;
  maxDailyLossUsd: number | null;
};
