import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortfolioSnapshot } from "../portfolio-types";
import type {
  RiskEventRecord,
  RiskLimit,
  RiskProfile,
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

export async function getActiveRiskProfileByPortfolio(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string
): Promise<RiskProfile | null> {
  const exactProfileResponse = await supabase
    .from("risk_profiles")
    .select(
      "id, user_id, portfolio_id, name, max_daily_loss_usd, max_position_size_pct, max_leverage, max_drawdown_pct, risk_per_trade_pct, is_active, updated_at"
    )
    .eq("user_id", userId)
    .eq("portfolio_id", portfolioId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (!exactProfileResponse.error && exactProfileResponse.data && exactProfileResponse.data.length > 0) {
    return toRiskProfile(exactProfileResponse.data[0] as RiskProfileRow);
  }

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
    violations.push({
      eventType: "drawdown_limit_breached",
      severity: selectSeverity(observedDrawdown, maxDrawdownPct),
      title: "Drawdown threshold breached",
      message: `Drawdown reached ${observedDrawdown.toFixed(2)}% (limit ${maxDrawdownPct.toFixed(2)}%).`,
      observedValue: observedDrawdown,
      thresholdValue: maxDrawdownPct,
      signature: `drawdown:${maxDrawdownPct.toFixed(2)}:${observedDrawdown.toFixed(2)}:${nowIso.slice(0, 13)}`,
    });
  }

  const maxPositionSizePct = profile.maxPositionSizePct;
  if (maxPositionSizePct !== null) {
    const oversizedPositions = snapshot.assets
      .filter((asset) => asset.allocationPercent > maxPositionSizePct)
      .sort((left, right) => right.allocationPercent - left.allocationPercent)
      .slice(0, 3);

    for (const asset of oversizedPositions) {
      violations.push({
        eventType: "position_size_limit_breached",
        severity: selectSeverity(asset.allocationPercent, maxPositionSizePct),
        title: "Position concentration too high",
        message: `${asset.symbol.replace("USDT", "")} allocation is ${asset.allocationPercent.toFixed(2)}% (limit ${maxPositionSizePct.toFixed(2)}%).`,
        observedValue: asset.allocationPercent,
        thresholdValue: maxPositionSizePct,
        symbol: asset.symbol,
        signature: `position:${asset.symbol}:${maxPositionSizePct.toFixed(2)}:${asset.allocationPercent.toFixed(2)}:${nowIso.slice(0, 13)}`,
      });
    }
  }

  const maxDailyLossUsd = profile.maxDailyLossUsd;
  if (maxDailyLossUsd !== null && snapshot.chart.length >= 2) {
    const previous = snapshot.chart[snapshot.chart.length - 2]?.totalValueUsd ?? 0;
    const current = snapshot.chart[snapshot.chart.length - 1]?.totalValueUsd ?? 0;
    const dailyLossUsd = Math.max(0, previous - current);

    if (dailyLossUsd > maxDailyLossUsd) {
      violations.push({
        eventType: "daily_loss_limit_breached",
        severity: selectSeverity(dailyLossUsd, maxDailyLossUsd),
        title: "Daily loss threshold breached",
        message: `Daily loss is ${dailyLossUsd.toFixed(2)} USD (limit ${maxDailyLossUsd.toFixed(2)} USD).`,
        observedValue: dailyLossUsd,
        thresholdValue: maxDailyLossUsd,
        signature: `daily-loss:${maxDailyLossUsd.toFixed(2)}:${dailyLossUsd.toFixed(2)}:${nowIso.slice(0, 13)}`,
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

export async function logRiskViolations(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  riskProfileId: string,
  violations: RiskViolation[]
): Promise<number> {
  if (violations.length === 0) {
    return 0;
  }

  let inserted = 0;

  for (const violation of violations) {
    const logged = await logRiskEventIfChanged(supabase, userId, {
      portfolioId,
      riskProfileId,
      eventType: violation.eventType,
      severity: violation.severity,
      details: {
        title: violation.title,
        message: violation.message,
        observedValue: violation.observedValue,
        thresholdValue: violation.thresholdValue,
        symbol: violation.symbol,
        signature: violation.signature,
      },
    });

    if (logged) {
      inserted += 1;
    }
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
