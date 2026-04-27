import type { SupabaseClient } from "@supabase/supabase-js";

import type { PortfolioAIRecommendation } from "../portfolio-types";

type RecommendationRow = {
  metadata: unknown;
};

function isPortfolioAIRecommendation(value: unknown): value is PortfolioAIRecommendation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const recommendation = value as Partial<PortfolioAIRecommendation>;
  return Boolean(
    recommendation.action &&
      typeof recommendation.confidence === "number" &&
      typeof recommendation.summary === "string" &&
      Array.isArray(recommendation.reasoning) &&
      Array.isArray(recommendation.portfolioActions) &&
      Array.isArray(recommendation.signals) &&
      typeof recommendation.analyzedAt === "string" &&
      typeof recommendation.snapshotTimestamp === "string" &&
      recommendation.evidence,
  );
}

export async function savePortfolioAIRecommendation(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  recommendation: PortfolioAIRecommendation,
): Promise<void> {
  const { error } = await supabase.from("portfolio_ai_recommendations").insert({
    user_id: userId,
    portfolio_id: portfolioId,
    portfolio_ui_session_id: recommendation.portfolioUiSessionId ?? null,
    analyzed_at: recommendation.analyzedAt,
    action: recommendation.action,
    confidence: recommendation.confidence,
    metadata: recommendation,
  });

  if (error) {
    throw error;
  }
}

export async function getLatestPortfolioAIRecommendation(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  portfolioUiSessionId?: string | null,
): Promise<PortfolioAIRecommendation | null> {
  const query = supabase
    .from("portfolio_ai_recommendations")
    .select("metadata")
    .eq("user_id", userId)
    .eq("portfolio_id", portfolioId);

  if (portfolioUiSessionId?.trim()) {
    query.eq("portfolio_ui_session_id", portfolioUiSessionId.trim());
  }

  const { data, error } = await query.order("analyzed_at", { ascending: false }).limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  const row = data[0] as RecommendationRow;
  if (!isPortfolioAIRecommendation(row.metadata)) {
    return null;
  }

  return row.metadata;
}
