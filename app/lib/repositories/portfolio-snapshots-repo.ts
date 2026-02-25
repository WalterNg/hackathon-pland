import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortfolioSnapshot } from "../portfolio-types";

type SnapshotRow = {
  metadata: unknown;
};

function isPortfolioSnapshot(value: unknown): value is PortfolioSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<PortfolioSnapshot>;
  return Boolean(snapshot.summary && snapshot.metrics && Array.isArray(snapshot.assets) && Array.isArray(snapshot.chart));
}

export async function savePortfolioSnapshotCache(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  snapshot: PortfolioSnapshot
): Promise<void> {
  await supabase.from("portfolio_snapshots").insert({
    user_id: userId,
    portfolio_id: portfolioId,
    snapshot_at: snapshot.summary.timestamp,
    nav_usd: snapshot.summary.totalValueUsd,
    total_exposure_usd: snapshot.summary.totalValueUsd,
    unrealized_pnl_usd: snapshot.metrics.allTimeProfitUsd,
    realized_pnl_usd: 0,
    drawdown_pct: null,
    win_rate: null,
    total_trades: 0,
    open_positions: snapshot.metrics.activeAssets,
    risk_score: null,
    metadata: snapshot
  });
}

export async function getLatestPortfolioSnapshotCache(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string
): Promise<PortfolioSnapshot | null> {
  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select("metadata")
    .eq("user_id", userId)
    .eq("portfolio_id", portfolioId)
    .order("snapshot_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  const row = data[0] as SnapshotRow;
  if (!isPortfolioSnapshot(row.metadata)) {
    return null;
  }

  return row.metadata;
}
