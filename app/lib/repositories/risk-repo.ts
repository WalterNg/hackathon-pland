import type { SupabaseClient } from "@supabase/supabase-js";

export type RiskEventInput = {
  portfolioId?: string;
  riskProfileId?: string;
  eventType: string;
  severity: "info" | "warning" | "critical";
  details?: Record<string, unknown>;
};

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
    details: input.details ?? {}
  });
}
