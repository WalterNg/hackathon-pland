export type RiskSeverity = "info" | "warning" | "critical";

export type RiskAlertStatus = "active" | "acknowledged" | "resolved";

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
  sharpeRatio30d: number | null;
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
};

export type RiskRulesFormValues = {
  maxDrawdownPct: number | null;
  maxPositionSizePct: number | null;
  maxDailyLossUsd: number | null;
};