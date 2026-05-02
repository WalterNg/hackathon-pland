import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortfolioSnapshot } from "../portfolio-types";
import type {
  RiskAlertRecord,
  RiskAlertStatus,
  RiskEventRecord,
  RiskLimit,
  RiskProfile,
  RiskRulesFormValues,
  RiskSeverity,
  RiskViolation,
} from "../risk-types";

export type RiskEventInput = {
  portfolioId?: string;
  riskProfileId?: string;
  eventType: string;
  severity: RiskSeverity;
  details?: Record<string, unknown>;
  occurredAt?: string;
};

type RiskProfileRow = {
  id: string;
  user_id: string;
  portfolio_id: string | null;
  name: string;
  max_daily_loss_usd: number | null;
  max_position_size_pct: number | null;
  max_leverage: number | null;
  max_drawdown_pct: number | null;
  risk_per_trade_pct: number | null;
  is_active: boolean;
  updated_at: string;
};

type RiskLimitRow = {
  id: string;
  risk_profile_id: string;
  limit_type: string;
  limit_value: number;
  is_enabled: boolean;
};

type RiskEventRow = {
  id: string;
  event_type: string;
  severity: RiskSeverity;
  details: unknown;
  occurred_at: string;
};

type RiskAlertRow = {
  id: string;
  portfolio_id: string | null;
  risk_profile_id: string | null;
  event_type: string;
  severity: RiskSeverity;
  status: RiskAlertStatus;
  title: string;
  message: string;
  observed_value: number | null;
  threshold_value: number | null;
  symbol: string | null;
  signature: string;
  trigger_count: number;
  first_triggered_at: string;
  last_triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  // E1: override fields
  override_reason: string | null;
  override_expires_at: string | null;
  override_value: number | null;
  override_at: string | null;
  // E2: snooze
  snoozed_until: string | null;
};

const EVENT_DEDUP_COOLDOWN_MINUTES = 15;

const toFiniteNumberOrNull = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function toRiskProfile(row: RiskProfileRow): RiskProfile {
  return {
    id: row.id,
    userId: row.user_id,
    portfolioId: row.portfolio_id,
    name: row.name,
    maxDailyLossUsd: toFiniteNumberOrNull(row.max_daily_loss_usd),
    maxPositionSizePct: toFiniteNumberOrNull(row.max_position_size_pct),
    maxLeverage: toFiniteNumberOrNull(row.max_leverage),
    maxDrawdownPct: toFiniteNumberOrNull(row.max_drawdown_pct),
    riskPerTradePct: toFiniteNumberOrNull(row.risk_per_trade_pct),
    isActive: Boolean(row.is_active),
    updatedAt: row.updated_at,
  };
}

function toRiskLimit(row: RiskLimitRow): RiskLimit {
  return {
    id: row.id,
    riskProfileId: row.risk_profile_id,
    limitType: row.limit_type,
    limitValue: Number(row.limit_value),
    isEnabled: Boolean(row.is_enabled),
  };
}

function parseEventDetails(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function selectSeverity(observed: number, threshold: number): RiskSeverity {
  if (threshold <= 0) {
    return "warning";
  }

  if (observed >= threshold * 1.25) {
    return "critical";
  }

  return "warning";
}

function toRiskAlert(row: RiskAlertRow): RiskAlertRecord {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    riskProfileId: row.risk_profile_id,
    eventType: row.event_type,
    severity: row.severity,
    status: row.status,
    title: row.title,
    message: row.message,
    observedValue: toFiniteNumberOrNull(row.observed_value),
    thresholdValue: toFiniteNumberOrNull(row.threshold_value),
    symbol: row.symbol ?? undefined,
    signature: row.signature,
    triggerCount: Math.max(1, Number(row.trigger_count ?? 1)),
    firstTriggeredAt: row.first_triggered_at,
    lastTriggeredAt: row.last_triggered_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    overrideReason: row.override_reason ?? null,
    overrideExpiresAt: row.override_expires_at ?? null,
    overrideValue: toFiniteNumberOrNull(row.override_value),
    overrideAt: row.override_at ?? null,
    snoozedUntil: row.snoozed_until ?? null,
  };
}

function toRiskEventDetails(violation: RiskViolation): Record<string, unknown> {
  return {
    title: violation.title,
    message: violation.message,
    observedValue: violation.observedValue,
    thresholdValue: violation.thresholdValue,
    symbol: violation.symbol,
    signature: violation.dedupKey,
    alertSignature: violation.signature,
  };
}

function toProfileInsert(input: RiskRulesFormValues, name: string, userId: string, portfolioId: string) {
  return {
    user_id: userId,
    portfolio_id: portfolioId,
    name,
    max_daily_loss_usd: input.maxDailyLossUsd,
    max_position_size_pct: input.maxPositionSizePct,
    max_leverage: null,
    max_drawdown_pct: input.maxDrawdownPct,
    risk_per_trade_pct: null,
    is_active: true,
  };
}

function toGlobalProfileInsert(input: RiskRulesFormValues, name: string, userId: string) {
  return {
    user_id: userId,
    portfolio_id: null,
    name,
    max_daily_loss_usd: input.maxDailyLossUsd,
    max_position_size_pct: input.maxPositionSizePct,
    max_leverage: null,
    max_drawdown_pct: input.maxDrawdownPct,
    risk_per_trade_pct: null,
    is_active: true,
  };
}

function isAlertStatus(value: string | null): value is RiskAlertStatus {
  return value === "active" || value === "acknowledged" || value === "resolved";
}

function limitNumber(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : value;
}

function escalatedSeverity(
  violation: RiskViolation,
  nextTriggerCount: number
): RiskSeverity {
  if (violation.severity === "critical") {
    return "critical";
  }

  return nextTriggerCount >= 3 ? "critical" : violation.severity;
}

function escalatedMessage(
  violation: RiskViolation,
  nextTriggerCount: number
): string {
  if (nextTriggerCount < 3) {
    return violation.message;
  }

  return `${violation.message} This breach has repeated ${nextTriggerCount} times while still active.`;
}

export async function getActiveRiskProfileByPortfolio(
  supabase: SupabaseClient,
  userId: string,
  _portfolioId: string
): Promise<RiskProfile | null> {
  const globalProfileResponse = await supabase
    .from("risk_profiles")
    .select(
      "id, user_id, portfolio_id, name, max_daily_loss_usd, max_position_size_pct, max_leverage, max_drawdown_pct, risk_per_trade_pct, is_active, updated_at"
    )
    .eq("user_id", userId)
    .is("portfolio_id", null)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (globalProfileResponse.error || !globalProfileResponse.data || globalProfileResponse.data.length === 0) {
    return null;
  }

  return toRiskProfile(globalProfileResponse.data[0] as RiskProfileRow);
}

export async function getGlobalRiskProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<RiskProfile | null> {
  return getActiveRiskProfileByPortfolio(supabase, userId, "global");
}

export async function getExactRiskProfileByPortfolio(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string
): Promise<RiskProfile | null> {
  const { data, error } = await supabase
    .from("risk_profiles")
    .select(
      "id, user_id, portfolio_id, name, max_daily_loss_usd, max_position_size_pct, max_leverage, max_drawdown_pct, risk_per_trade_pct, is_active, updated_at"
    )
    .eq("user_id", userId)
    .eq("portfolio_id", portfolioId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return toRiskProfile(data[0] as RiskProfileRow);
}

export async function upsertPortfolioRiskProfile(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  input: RiskRulesFormValues,
  name = "Spot Risk Rules"
): Promise<RiskProfile | null> {
  const existing = await getExactRiskProfileByPortfolio(supabase, userId, portfolioId);

  if (existing?.id) {
    const { data, error } = await supabase
      .from("risk_profiles")
      .update({
        name,
        max_daily_loss_usd: input.maxDailyLossUsd,
        max_position_size_pct: input.maxPositionSizePct,
        max_drawdown_pct: input.maxDrawdownPct,
        is_active: true,
      })
      .eq("id", existing.id)
      .eq("user_id", userId)
      .select(
        "id, user_id, portfolio_id, name, max_daily_loss_usd, max_position_size_pct, max_leverage, max_drawdown_pct, risk_per_trade_pct, is_active, updated_at"
      )
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    return toRiskProfile(data[0] as RiskProfileRow);
  }

  const { data, error } = await supabase
    .from("risk_profiles")
    .insert(toProfileInsert(input, name, userId, portfolioId))
    .select(
      "id, user_id, portfolio_id, name, max_daily_loss_usd, max_position_size_pct, max_leverage, max_drawdown_pct, risk_per_trade_pct, is_active, updated_at"
    )
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return toRiskProfile(data[0] as RiskProfileRow);
}

export async function upsertGlobalRiskProfile(
  supabase: SupabaseClient,
  userId: string,
  input: RiskRulesFormValues,
  name = "Global Spot Risk Rules"
): Promise<RiskProfile | null> {
  const existing = await getGlobalRiskProfile(supabase, userId);

  if (existing?.id) {
    const { data, error } = await supabase
      .from("risk_profiles")
      .update({
        name,
        max_daily_loss_usd: input.maxDailyLossUsd,
        max_position_size_pct: input.maxPositionSizePct,
        max_drawdown_pct: input.maxDrawdownPct,
        is_active: true,
      })
      .eq("id", existing.id)
      .eq("user_id", userId)
      .select(
        "id, user_id, portfolio_id, name, max_daily_loss_usd, max_position_size_pct, max_leverage, max_drawdown_pct, risk_per_trade_pct, is_active, updated_at"
      )
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    return toRiskProfile(data[0] as RiskProfileRow);
  }

  const { data, error } = await supabase
    .from("risk_profiles")
    .insert(toGlobalProfileInsert(input, name, userId))
    .select(
      "id, user_id, portfolio_id, name, max_daily_loss_usd, max_position_size_pct, max_leverage, max_drawdown_pct, risk_per_trade_pct, is_active, updated_at"
    )
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return toRiskProfile(data[0] as RiskProfileRow);
}

export async function listRiskLimitsByProfile(
  supabase: SupabaseClient,
  userId: string,
  riskProfileId: string
): Promise<RiskLimit[]> {
  const { data, error } = await supabase
    .from("risk_limits")
    .select("id, risk_profile_id, limit_type, limit_value, is_enabled")
    .eq("user_id", userId)
    .eq("risk_profile_id", riskProfileId)
    .eq("is_enabled", true);

  if (error || !data) {
    return [];
  }

  return (data as RiskLimitRow[]).map(toRiskLimit);
}

export function applyRiskLimitOverrides(profile: RiskProfile, limits: RiskLimit[]): RiskProfile {
  if (limits.length === 0) {
    return profile;
  }

  const nextProfile = { ...profile };

  for (const limit of limits) {
    switch (limit.limitType) {
      case "max_drawdown_pct":
        nextProfile.maxDrawdownPct = limit.limitValue;
        break;
      case "max_position_size_pct":
        nextProfile.maxPositionSizePct = limit.limitValue;
        break;
      case "max_daily_loss_usd":
        nextProfile.maxDailyLossUsd = limit.limitValue;
        break;
      case "max_leverage":
        nextProfile.maxLeverage = limit.limitValue;
        break;
      case "risk_per_trade_pct":
        nextProfile.riskPerTradePct = limit.limitValue;
        break;
      default:
        break;
    }
  }

  return nextProfile;
}

export function evaluateRiskViolations(
  snapshot: PortfolioSnapshot,
  profile: RiskProfile | null
): RiskViolation[] {
  if (!profile) {
    return [];
  }

  const violations: RiskViolation[] = [];
  const nowIso = new Date().toISOString();

  const maxDrawdownPct = profile.maxDrawdownPct;
  const observedDrawdown = snapshot.metrics.maxDrawdownPercent ?? 0;
  if (maxDrawdownPct !== null && observedDrawdown > maxDrawdownPct) {
    const signature = `drawdown:${maxDrawdownPct.toFixed(2)}`;
    violations.push({
      eventType: "drawdown_limit_breached",
      severity: selectSeverity(observedDrawdown, maxDrawdownPct),
      title: "Drawdown threshold breached",
      message: `Drawdown reached ${observedDrawdown.toFixed(2)}% (limit ${maxDrawdownPct.toFixed(2)}%).`,
      observedValue: observedDrawdown,
      thresholdValue: maxDrawdownPct,
      signature,
      dedupKey: `${signature}:${nowIso.slice(0, 13)}`,
    });
  }

  const maxPositionSizePct = profile.maxPositionSizePct;
  if (maxPositionSizePct !== null) {
    const oversizedPositions = snapshot.assets
      .filter((asset) => asset.allocationPercent > maxPositionSizePct)
      .sort((left, right) => right.allocationPercent - left.allocationPercent)
      .slice(0, 3);

    for (const asset of oversizedPositions) {
      const signature = `position:${asset.symbol}:${maxPositionSizePct.toFixed(2)}`;
      violations.push({
        eventType: "position_size_limit_breached",
        severity: selectSeverity(asset.allocationPercent, maxPositionSizePct),
        title: "Position concentration too high",
        message: `${asset.symbol.replace("USDT", "")} allocation is ${asset.allocationPercent.toFixed(2)}% (limit ${maxPositionSizePct.toFixed(2)}%).`,
        observedValue: asset.allocationPercent,
        thresholdValue: maxPositionSizePct,
        symbol: asset.symbol,
        signature,
        dedupKey: `${signature}:${nowIso.slice(0, 13)}`,
      });
    }
  }

  const maxDailyLossUsd = profile.maxDailyLossUsd;
  if (maxDailyLossUsd !== null && snapshot.chart.length >= 2) {
    const previous = snapshot.chart[snapshot.chart.length - 2]?.totalValueUsd ?? 0;
    const current = snapshot.chart[snapshot.chart.length - 1]?.totalValueUsd ?? 0;
    const dailyLossUsd = Math.max(0, previous - current);

    if (dailyLossUsd > maxDailyLossUsd) {
      const signature = `daily-loss:${maxDailyLossUsd.toFixed(2)}`;
      violations.push({
        eventType: "daily_loss_limit_breached",
        severity: selectSeverity(dailyLossUsd, maxDailyLossUsd),
        title: "Daily loss threshold breached",
        message: `Daily loss is ${dailyLossUsd.toFixed(2)} USD (limit ${maxDailyLossUsd.toFixed(2)} USD).`,
        observedValue: dailyLossUsd,
        thresholdValue: maxDailyLossUsd,
        signature,
        dedupKey: `${signature}:${nowIso.slice(0, 13)}`,
      });
    }
  }

  return violations;
}

export async function logRiskEvent(
  supabase: SupabaseClient,
  userId: string,
  input: RiskEventInput
) {
  return supabase.from("risk_events").insert({
    user_id: userId,
    portfolio_id: input.portfolioId ?? null,
    risk_profile_id: input.riskProfileId ?? null,
    event_type: input.eventType,
    severity: input.severity,
    details: input.details ?? {},
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  });
}

export async function logRiskEventIfChanged(
  supabase: SupabaseClient,
  userId: string,
  input: RiskEventInput,
  cooldownMinutes = EVENT_DEDUP_COOLDOWN_MINUTES
): Promise<boolean> {
  let query = supabase
    .from("risk_events")
    .select("id, occurred_at, details")
    .eq("user_id", userId)
    .eq("event_type", input.eventType)
    .order("occurred_at", { ascending: false })
    .limit(1);

  query = input.portfolioId ? query.eq("portfolio_id", input.portfolioId) : query.is("portfolio_id", null);

  const { data, error } = await query;

  if (!error && data && data.length > 0) {
    const latest = data[0] as { occurred_at: string; details: unknown };
    const occurredMs = new Date(latest.occurred_at).getTime();
    const nowMs = Date.now();
    const inCooldown = Number.isFinite(occurredMs)
      ? nowMs - occurredMs <= cooldownMinutes * 60_000
      : false;

    const latestSignature = parseEventDetails(latest.details).signature;
    const nextSignature = input.details?.signature;
    if (inCooldown && latestSignature && nextSignature && latestSignature === nextSignature) {
      return false;
    }
  }

  const insertResult = await logRiskEvent(supabase, userId, input);
  return !insertResult.error;
}

export async function listRiskAlerts(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  status: RiskAlertStatus | "all" = "active",
  limit = 20
): Promise<RiskAlertRecord[]> {
  const boundedLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 100) : 20;
  let query = supabase
    .from("risk_alerts")
    .select(
      "id, portfolio_id, risk_profile_id, event_type, severity, status, title, message, observed_value, threshold_value, symbol, signature, trigger_count, first_triggered_at, last_triggered_at, acknowledged_at, resolved_at"
    )
    .eq("user_id", userId)
    .eq("portfolio_id", portfolioId)
    .order("last_triggered_at", { ascending: false })
    .limit(boundedLimit);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  return (data as RiskAlertRow[]).map(toRiskAlert);
}

export async function listRiskAlertsByPortfolioIds(
  supabase: SupabaseClient,
  userId: string,
  portfolioIds: string[],
  status: RiskAlertStatus | "all" = "active",
  limit = 200
): Promise<RiskAlertRecord[]> {
  if (portfolioIds.length === 0) {
    return [];
  }

  const boundedLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 500) : 200;
  let query = supabase
    .from("risk_alerts")
    .select(
      "id, portfolio_id, risk_profile_id, event_type, severity, status, title, message, observed_value, threshold_value, symbol, signature, trigger_count, first_triggered_at, last_triggered_at, acknowledged_at, resolved_at"
    )
    .eq("user_id", userId)
    .in("portfolio_id", portfolioIds)
    .order("last_triggered_at", { ascending: false })
    .limit(boundedLimit);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  return (data as RiskAlertRow[]).map(toRiskAlert);
}

const ALERT_SELECT_FIELDS =
  "id, portfolio_id, risk_profile_id, event_type, severity, status, title, message, " +
  "observed_value, threshold_value, symbol, signature, trigger_count, " +
  "first_triggered_at, last_triggered_at, acknowledged_at, resolved_at, " +
  "override_reason, override_expires_at, override_value, override_at, snoozed_until";

export type OverrideAlertPayload = {
  reason?: string;
  expiresInHours: number | null;
  snoozedUntilMinutes?: number; // E2
};

export async function updateRiskAlertStatus(
  supabase: SupabaseClient,
  userId: string,
  alertId: string,
  status: RiskAlertStatus,
  overridePayload?: OverrideAlertPayload
): Promise<RiskAlertRecord | null> {
  const nowIso = new Date().toISOString();

  // Fetch current alert to capture observed_value for override_value
  const { data: existing } = await supabase
    .from("risk_alerts")
    .select(ALERT_SELECT_FIELDS)
    .eq("id", alertId)
    .eq("user_id", userId)
    .limit(1);
  const current = existing?.[0] as unknown as RiskAlertRow | undefined;

  const patch: Record<string, unknown> = {
    status,
    acknowledged_at: status === "acknowledged" ? nowIso : null,
    resolved_at: status === "resolved" ? nowIso : null,
  };

  if (status === "snoozed" && overridePayload?.snoozedUntilMinutes) {
    const snoozedUntil = new Date(
      Date.now() + overridePayload.snoozedUntilMinutes * 60_000
    ).toISOString();
    patch.snoozed_until = snoozedUntil;
  } else if (status !== "snoozed") {
    patch.snoozed_until = null; // clear on any other transition
  }

  if (status === "overridden" && overridePayload) {
    patch.override_at = nowIso;
    patch.override_reason = overridePayload.reason ?? null;
    patch.override_value = current?.observed_value ?? null;
    patch.override_expires_at = overridePayload.expiresInHours !== null
      ? new Date(Date.now() + overridePayload.expiresInHours * 3_600_000).toISOString()
      : null;
  }

  const { data, error } = await supabase
    .from("risk_alerts")
    .update(patch)
    .eq("id", alertId)
    .eq("user_id", userId)
    .select(ALERT_SELECT_FIELDS)
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return toRiskAlert(data[0] as unknown as RiskAlertRow);
}

export async function revokeRiskAlertOverride(
  supabase: SupabaseClient,
  userId: string,
  alertId: string
): Promise<RiskAlertRecord | null> {
  const { data, error } = await supabase
    .from("risk_alerts")
    .update({
      status: "active",
      override_reason: null,
      override_expires_at: null,
      override_value: null,
      override_at: null,
    })
    .eq("id", alertId)
    .eq("user_id", userId)
    .eq("status", "overridden")
    .select(ALERT_SELECT_FIELDS)
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return toRiskAlert(data[0] as unknown as RiskAlertRow);
}

export async function cancelRiskAlertSnooze(
  supabase: SupabaseClient,
  userId: string,
  alertId: string
): Promise<RiskAlertRecord | null> {
  const { data, error } = await supabase
    .from("risk_alerts")
    .update({ status: "active", snoozed_until: null })
    .eq("id", alertId)
    .eq("user_id", userId)
    .eq("status", "snoozed")
    .select(ALERT_SELECT_FIELDS)
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return toRiskAlert(data[0] as unknown as RiskAlertRow);
}

export async function logRiskViolations(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  riskProfileId: string,
  violations: RiskViolation[]
): Promise<number> {
  let inserted = 0;
  const nowIso = new Date().toISOString();
  const activeAlerts = await listRiskAlerts(supabase, userId, portfolioId, "active", 100);
  const activeAlertsBySignature = new Map(activeAlerts.map((alert) => [alert.signature, alert]));
  const nextSignatures = new Set(violations.map((violation) => violation.signature));

  for (const violation of violations) {
    const existingAlert = activeAlertsBySignature.get(violation.signature);
    const nextTriggerCount = existingAlert ? Math.max(1, existingAlert.triggerCount) + 1 : 1;
    const severity = escalatedSeverity(violation, nextTriggerCount);
    const message = escalatedMessage(violation, nextTriggerCount);
    const logged = await logRiskEventIfChanged(supabase, userId, {
      portfolioId,
      riskProfileId,
      eventType: violation.eventType,
      severity,
      details: {
        ...toRiskEventDetails(violation),
        message,
        triggerCount: nextTriggerCount,
      },
    });

    if (logged) {
      inserted += 1;
    }

    if (!existingAlert) {
      await supabase.from("risk_alerts").insert({
        user_id: userId,
        portfolio_id: portfolioId,
        risk_profile_id: riskProfileId,
        event_type: violation.eventType,
        severity,
        status: "active",
        title: violation.title,
        message,
        observed_value: limitNumber(violation.observedValue),
        threshold_value: limitNumber(violation.thresholdValue),
        symbol: violation.symbol ?? null,
        signature: violation.signature,
        trigger_count: nextTriggerCount,
        first_triggered_at: nowIso,
        last_triggered_at: nowIso,
        acknowledged_at: null,
        resolved_at: null,
      });
      continue;
    }

    if (logged) {
      await supabase
        .from("risk_alerts")
        .update({
          risk_profile_id: riskProfileId,
          severity,
          title: violation.title,
          message,
          observed_value: limitNumber(violation.observedValue),
          threshold_value: limitNumber(violation.thresholdValue),
          symbol: violation.symbol ?? null,
          last_triggered_at: nowIso,
          trigger_count: nextTriggerCount,
        })
        .eq("id", existingAlert.id)
        .eq("user_id", userId);
    }
  }

  const staleAlerts = activeAlerts.filter((alert) => !nextSignatures.has(alert.signature));
  for (const alert of staleAlerts) {
    await supabase
      .from("risk_alerts")
      .update({
        status: "resolved",
        resolved_at: nowIso,
      })
      .eq("id", alert.id)
      .eq("user_id", userId);
  }

  return inserted;
}

export async function listRecentRiskEvents(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  limit = 6
): Promise<RiskEventRecord[]> {
  const boundedLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 20) : 6;
  const { data, error } = await supabase
    .from("risk_events")
    .select("id, event_type, severity, details, occurred_at")
    .eq("user_id", userId)
    .eq("portfolio_id", portfolioId)
    .order("occurred_at", { ascending: false })
    .limit(boundedLimit);

  if (error || !data) {
    return [];
  }

  return (data as RiskEventRow[]).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    severity: row.severity,
    details: parseEventDetails(row.details),
    occurredAt: row.occurred_at,
  }));
}
