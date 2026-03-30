import type {
  PortfolioAIRecommendation,
  PortfolioAIRecommendationLinkedAlert,
  PortfolioAIRecommendationMetadata,
  PortfolioAIRecommendedAction,
} from "@/app/lib/portfolio-types";
import type { RiskAlertRecord, RiskProfile, RiskRulesFormValues, RiskSeverity } from "@/app/lib/risk-types";

export type AIRecommendationActionPayload =
  | {
      type: "sell-intent";
      symbol: string;
      note: string;
    }
  | {
      type: "apply-protective-rules";
      values: RiskRulesFormValues;
      note: string;
    }
  | {
      type: "open-alert-center";
      note: string;
    };

export type AIRecommendationActionCard = {
  id: string;
  title: string;
  primary: string;
  secondary?: string;
  buttonLabel: string;
  icon: string;
  severity: RiskSeverity;
  rationale: string;
  linkedAlertLabel?: string;
  payload: AIRecommendationActionPayload;
};

function preferredAlert(alerts: RiskAlertRecord[]): RiskAlertRecord | null {
  return (
    alerts.find((alert) => alert.status === "active" && alert.severity === "critical") ??
    alerts.find((alert) => alert.status === "active") ??
    alerts[0] ??
    null
  );
}

function compareSeverity(left: RiskSeverity, right: RiskSeverity): number {
  const order: Record<RiskSeverity, number> = { info: 0, warning: 1, critical: 2 };
  return order[left] - order[right];
}

function recommendationSeverity(
  recommendation: PortfolioAIRecommendation,
  linkedAlert: RiskAlertRecord | null
): RiskSeverity {
  if (linkedAlert?.severity) {
    return linkedAlert.severity;
  }

  if (recommendation.action === "Stop Loss") {
    return "critical";
  }

  if (recommendation.action === "Reduce Risk" || recommendation.action === "Rebalance") {
    return "warning";
  }

  return "info";
}

function sellPercent(recommendation: PortfolioAIRecommendation, severity: RiskSeverity): number {
  if (recommendation.action === "Stop Loss") {
    return 35;
  }

  if (recommendation.action === "Reduce Risk") {
    return severity === "critical" ? 30 : 25;
  }

  if (recommendation.action === "Rebalance") {
    return 20;
  }

  return 15;
}

function roundRule(value: number): number {
  return Number(value.toFixed(2));
}

function buildProtectiveRules(profile: RiskProfile | null, severity: RiskSeverity): RiskRulesFormValues {
  const floor = severity === "critical"
    ? { maxDrawdownPct: 12, maxPositionSizePct: 15, maxDailyLossUsd: 250 }
    : { maxDrawdownPct: 15, maxPositionSizePct: 18, maxDailyLossUsd: 400 };

  return {
    maxDrawdownPct:
      profile?.maxDrawdownPct !== null && profile?.maxDrawdownPct !== undefined
        ? roundRule(Math.max(floor.maxDrawdownPct, profile.maxDrawdownPct * (severity === "critical" ? 0.78 : 0.9)))
        : floor.maxDrawdownPct,
    maxPositionSizePct:
      profile?.maxPositionSizePct !== null && profile?.maxPositionSizePct !== undefined
        ? roundRule(Math.max(floor.maxPositionSizePct, profile.maxPositionSizePct * (severity === "critical" ? 0.72 : 0.84)))
        : floor.maxPositionSizePct,
    maxDailyLossUsd:
      profile?.maxDailyLossUsd !== null && profile?.maxDailyLossUsd !== undefined
        ? roundRule(Math.max(floor.maxDailyLossUsd, profile.maxDailyLossUsd * (severity === "critical" ? 0.72 : 0.86)))
        : floor.maxDailyLossUsd,
  };
}

function formatRuleSummary(values: RiskRulesFormValues): string {
  return `Drawdown ${values.maxDrawdownPct ?? "-"}% • Position ${values.maxPositionSizePct ?? "-"}% • Daily loss ${values.maxDailyLossUsd ?? "-"} USD`;
}

function linkedAlertSummary(alert: RiskAlertRecord | null): string | undefined {
  if (!alert) {
    return undefined;
  }

  return alert.triggerCount > 1 ? `${alert.title} • ${alert.triggerCount} triggers` : alert.title;
}

function linkedAlertSummaryFromMetadata(linkedAlert: PortfolioAIRecommendationLinkedAlert | null): string | undefined {
  if (!linkedAlert) {
    return undefined;
  }

  return linkedAlert.triggerCount > 1 ? `${linkedAlert.title} • ${linkedAlert.triggerCount} triggers` : linkedAlert.title;
}

function normalizeSymbol(symbol: string | null | undefined): string {
  const normalized = symbol?.trim().toUpperCase() || "BTCUSDT";
  if (normalized.endsWith("USDT") || normalized.endsWith("USDC") || normalized.endsWith("BUSD") || normalized.endsWith("FDUSD")) {
    return normalized;
  }

  return `${normalized}USDT`;
}

function toMetadataLinkedAlerts(alerts: RiskAlertRecord[]): PortfolioAIRecommendationLinkedAlert[] {
  return alerts.slice(0, 3).map((alert) => ({
    id: alert.id,
    eventType: alert.eventType,
    severity: alert.severity,
    status: alert.status,
    title: alert.title,
    message: alert.message,
    symbol: alert.symbol,
    triggerCount: alert.triggerCount,
  }));
}

export function deriveRecommendationMetadata(
  recommendation: Pick<PortfolioAIRecommendation, "action" | "summary" | "evidence">,
  alerts: RiskAlertRecord[],
  profile: RiskProfile | null
): PortfolioAIRecommendationMetadata {
  const linkedAlert = preferredAlert(alerts);
  const urgency = recommendationSeverity(recommendation as PortfolioAIRecommendation, linkedAlert);
  const symbol = normalizeSymbol(linkedAlert?.symbol ?? recommendation.evidence.topAllocationSymbol);
  const trimPercent = sellPercent(recommendation as PortfolioAIRecommendation, urgency);
  const protectiveRules = buildProtectiveRules(profile, urgency);
  const linkedNote = linkedAlert ? `${linkedAlert.title}. ${linkedAlert.message}` : recommendation.summary;
  const immediateAction: PortfolioAIRecommendedAction =
    urgency === "info" && recommendation.action !== "Reduce Risk" && recommendation.action !== "Rebalance" && recommendation.action !== "Stop Loss"
      ? {
          type: "open-alert-center",
          title: "Review current alerts and concentration drivers",
          note: recommendation.summary,
          severity: urgency,
        }
      : {
          type: "sell-intent",
          title: `Target: Sell ${trimPercent}% of ${symbol}`,
          note: `AI recommendation: ${recommendation.action}. ${linkedNote}`,
          severity: urgency,
          symbol,
          trimPercent,
        };

  const defensiveAction: PortfolioAIRecommendedAction = {
    type: "apply-protective-rules",
    title: `Tighten protection for ${symbol.replace(/USDT$/u, "")}`,
    note: `Applied defensive rules from AI recommendation: ${recommendation.action}`,
    severity: urgency,
    values: protectiveRules,
  };

  return {
    urgency,
    primarySymbol: symbol,
    linkedAlerts: toMetadataLinkedAlerts(alerts),
    recommendedActions: [immediateAction, defensiveAction],
    suggestedRulePatch: protectiveRules,
    suggestedTransactionIntent:
      immediateAction.type === "sell-intent" && immediateAction.symbol && immediateAction.trimPercent
        ? {
            action: "sell",
            symbol: immediateAction.symbol,
            trimPercent: immediateAction.trimPercent,
            note: immediateAction.note,
          }
        : null,
  };
}

function resolveLinkedAlert(
  recommendation: PortfolioAIRecommendation,
  alerts: RiskAlertRecord[]
): RiskAlertRecord | null {
  const linkedAlertIds = new Set((recommendation.metadata?.linkedAlerts ?? []).map((alert) => alert.id));
  if (linkedAlertIds.size > 0) {
    const matched = alerts.find((alert) => linkedAlertIds.has(alert.id));
    if (matched) {
      return matched;
    }
  }

  const primaryLink = recommendation.metadata?.linkedAlerts[0] ?? null;
  if (primaryLink) {
    const matched = alerts.find(
      (alert) =>
        alert.eventType === primaryLink.eventType &&
        alert.symbol === primaryLink.symbol &&
        alert.severity === primaryLink.severity,
    );
    if (matched) {
      return matched;
    }
  }

  return preferredAlert(alerts);
}

export function toSelectedCoin(symbol: string): { symbol: string; baseAsset: string; quoteAsset: string } {
  const upper = normalizeSymbol(symbol);
  const quoteAsset = upper.endsWith("USDT") ? "USDT" : "USD";
  const baseAsset = upper.endsWith(quoteAsset) ? upper.slice(0, upper.length - quoteAsset.length) : upper;

  return {
    symbol: upper,
    baseAsset,
    quoteAsset,
  };
}

export function buildRecommendationActionCards(
  recommendation: PortfolioAIRecommendation,
  alerts: RiskAlertRecord[],
  profile: RiskProfile | null
): AIRecommendationActionCard[] {
  const metadata = recommendation.metadata ?? deriveRecommendationMetadata(recommendation, alerts, profile);
  const linkedAlert = resolveLinkedAlert(recommendation, alerts);
  const severity = metadata.urgency || recommendationSeverity(recommendation, linkedAlert);
  const symbol = normalizeSymbol(
    metadata.suggestedTransactionIntent?.symbol ??
      metadata.primarySymbol ??
      linkedAlert?.symbol ??
      recommendation.evidence.topAllocationSymbol,
  );
  const assetLabel = symbol.replace(/USDT$/u, "");
  const trimPct = metadata.suggestedTransactionIntent?.trimPercent ?? sellPercent(recommendation, severity);
  const protectiveRules = metadata.suggestedRulePatch ?? buildProtectiveRules(profile, severity);
  const alertSummary =
    linkedAlertSummary(linkedAlert) ?? linkedAlertSummaryFromMetadata(metadata.linkedAlerts[0] ?? null);
  const linkedNote = linkedAlert
    ? `${linkedAlert.title}. ${linkedAlert.message}`
    : recommendation.summary;
  const immediateAction = metadata.recommendedActions.find((action) => action.type === "sell-intent" || action.type === "open-alert-center");
  const defensiveAction = metadata.recommendedActions.find((action) => action.type === "apply-protective-rules");

  const immediateCard: AIRecommendationActionCard =
    immediateAction?.type === "open-alert-center" ||
    (severity === "info" && recommendation.action !== "Reduce Risk" && recommendation.action !== "Rebalance" && recommendation.action !== "Stop Loss")
      ? {
          id: "review-alerts",
          title: "Risk Context",
          primary: immediateAction?.title ?? "Review current alerts and concentration drivers",
          secondary: alertSummary ?? "No active breach is linked yet. Review the latest risk context before changing exposure.",
          buttonLabel: "Open Alert Center",
          icon: "notifications",
          severity,
          rationale: recommendation.summary,
          linkedAlertLabel: alertSummary,
          payload: {
            type: "open-alert-center",
            note: immediateAction?.note ?? recommendation.summary,
          },
        }
      : {
          id: "sell-intent",
          title: "Immediate Action",
          primary: immediateAction?.title ?? `Target: Sell ${trimPct}% of ${symbol}`,
          secondary: alertSummary ?? `Largest exposure remains ${assetLabel}; use this as the first trim candidate.`,
          buttonLabel: "Open Sell Flow",
          icon: "sell",
          severity,
          rationale: linkedAlert?.message ?? recommendation.summary,
          linkedAlertLabel: alertSummary,
          payload: {
            type: "sell-intent",
            symbol: immediateAction?.symbol ?? symbol,
            note: immediateAction?.note ?? `AI recommendation: ${recommendation.action}. ${linkedNote}`,
          },
        };

  const defensiveCard: AIRecommendationActionCard = {
    id: "apply-protection",
    title: "Protective Setup",
    primary: defensiveAction?.title ?? `Tighten protection for ${assetLabel}`,
    secondary: formatRuleSummary(protectiveRules),
    buttonLabel: "Apply Defensive Rule",
    icon: "shield",
    severity,
    rationale:
      severity === "critical"
        ? "Critical pressure detected. Tightening drawdown and concentration limits will raise protection immediately."
        : "This recommendation can be paired with a tighter rule profile to reduce repeat breaches.",
    linkedAlertLabel: alertSummary,
    payload: {
      type: "apply-protective-rules",
      values: defensiveAction?.values ?? protectiveRules,
      note: defensiveAction?.note ?? `Applied defensive rules from AI recommendation: ${recommendation.action}`,
    },
  };

  return [immediateCard, defensiveCard];
}