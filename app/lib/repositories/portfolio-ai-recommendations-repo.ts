import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  PortfolioAIRecommendation,
  PortfolioAIRecommendationHistoryItem,
  PortfolioAIRecommendationHistoryPage,
} from "../portfolio-types";

type RecommendationRow = {
  id: string;
  analyzed_at: string;
  action: string;
  confidence: number;
  portfolio_ui_session_id: string | null;
  created_at: string;
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

function mapRecommendationRow(row: RecommendationRow): PortfolioAIRecommendationHistoryItem | null {
  if (!isPortfolioAIRecommendation(row.metadata)) {
    return null;
  }

  return {
    id: row.id,
    analyzedAt: row.analyzed_at,
    createdAt: row.created_at,
    action: row.metadata.action,
    confidence: row.metadata.confidence,
    portfolioUiSessionId: row.portfolio_ui_session_id ?? row.metadata.portfolioUiSessionId ?? null,
    recommendation: row.metadata,
  };
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

export async function listPortfolioAIRecommendationHistory(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  page: number,
  pageSize: number,
  portfolioUiSessionId?: string | null,
): Promise<PortfolioAIRecommendationHistoryPage> {
  const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedPageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 10;
  const start = (normalizedPage - 1) * normalizedPageSize;
  const end = start + normalizedPageSize - 1;

  const query = supabase
    .from("portfolio_ai_recommendations")
    .select("id, analyzed_at, action, confidence, portfolio_ui_session_id, created_at, metadata", {
      count: "exact",
    })
    .eq("user_id", userId)
    .eq("portfolio_id", portfolioId);

  if (portfolioUiSessionId?.trim()) {
    query.eq("portfolio_ui_session_id", portfolioUiSessionId.trim());
  }

  const { data, error, count } = await query
    .order("analyzed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    throw error;
  }

  const items = (data ?? [])
    .map((row) => mapRecommendationRow(row as RecommendationRow))
    .filter((item): item is PortfolioAIRecommendationHistoryItem => item !== null);

  const totalCount = typeof count === "number" ? count : items.length;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / normalizedPageSize) : 0;

  return {
    items,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalCount,
    totalPages,
    hasNextPage: normalizedPage < totalPages,
  };
}
