import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortfolioPosition, PortfolioSymbol, PortfolioTransaction } from "../portfolio-types";
import { MAIN_PORTFOLIO_NAME } from "./portfolios-repo";

type TransactionRow = {
  symbol: string;
  side: "buy" | "sell" | "deposit" | "withdrawal" | "airdrop" | "fee";
  quantity: number;
  price_usd: number;
};

type FullTransactionRow = TransactionRow & { executed_at: string };

function toPortfolioSymbol(symbol: string): PortfolioSymbol | null {
  const normalized = symbol.toUpperCase().trim();
  if (!normalized) {
    return null;
  }

  return normalized;
}

async function resolvePortfolioIds(
  supabase: SupabaseClient,
  userId: string,
  portfolioName: string
): Promise<string[] | null> {
  const normalizedName = portfolioName.trim() || MAIN_PORTFOLIO_NAME;

  if (normalizedName === MAIN_PORTFOLIO_NAME) {
    const { data: portfolios, error } = await supabase
      .from("portfolios")
      .select("id, name")
      .eq("user_id", userId);
    if (error || !portfolios) return null;
    return (portfolios as Array<{ id: string; name: string }>)
      .filter((p) => p.name !== MAIN_PORTFOLIO_NAME)
      .map((p) => p.id);
  }

  const { data: portfolio, error } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .eq("name", normalizedName)
    .maybeSingle();
  if (error) return null;
  if (!portfolio?.id) return [];
  return [portfolio.id];
}

export async function getUserPortfolioPositions(
  supabase: SupabaseClient,
  userId: string,
  portfolioName: string
): Promise<PortfolioPosition[] | null> {
  const targetPortfolioIds = await resolvePortfolioIds(supabase, userId, portfolioName);
  if (targetPortfolioIds === null) return null;
  if (targetPortfolioIds.length === 0) return [];

  const { data: transactions, error: transactionError } = await supabase
    .from("portfolio_transactions")
    .select("symbol, side, quantity, price_usd")
    .eq("user_id", userId)
    .in("portfolio_id", targetPortfolioIds)
    .order("executed_at", { ascending: true });

  if (transactionError || !transactions) {
    return null;
  }

  const aggregation = new Map<PortfolioSymbol, { quantity: number; costUsd: number }>();

  for (const row of transactions as TransactionRow[]) {
    const symbol = toPortfolioSymbol(row.symbol);
    if (!symbol) {
      continue;
    }

    const existing = aggregation.get(symbol) ?? { quantity: 0, costUsd: 0 };
    const qty = Number(row.quantity) || 0;
    const price = Number(row.price_usd) || 0;

    if (row.side === "buy" || row.side === "deposit" || row.side === "airdrop") {
      existing.quantity += qty;
      existing.costUsd += qty * price;
    } else if (row.side === "sell" || row.side === "withdrawal") {
      const beforeQty = existing.quantity;
      const avgCost = beforeQty > 0 ? existing.costUsd / beforeQty : 0;
      existing.quantity = Math.max(0, beforeQty - qty);
      existing.costUsd = Math.max(0, existing.costUsd - qty * avgCost);
    }

    aggregation.set(symbol, existing);
  }

  const positions: PortfolioPosition[] = [];
  for (const [symbol, value] of aggregation.entries()) {
    if (value.quantity <= 0) {
      continue;
    }

    positions.push({
      symbol,
      quantity: Number(value.quantity.toFixed(12)),
      avgBuyPriceUsd: value.quantity > 0 ? Number((value.costUsd / value.quantity).toFixed(8)) : 0
    });
  }

  return positions;
}

/**
 * Fetch all raw transactions for a portfolio, ordered by execution time ascending.
 * Used to reconstruct holdings state at any point in history for chart building.
 */
export async function getUserPortfolioTransactions(
  supabase: SupabaseClient,
  userId: string,
  portfolioName: string
): Promise<PortfolioTransaction[] | null> {
  const targetPortfolioIds = await resolvePortfolioIds(supabase, userId, portfolioName);
  if (targetPortfolioIds === null) return null;
  if (targetPortfolioIds.length === 0) return [];

  const { data: rows, error } = await supabase
    .from("portfolio_transactions")
    .select("symbol, side, quantity, price_usd, executed_at")
    .eq("user_id", userId)
    .in("portfolio_id", targetPortfolioIds)
    .order("executed_at", { ascending: true });

  if (error || !rows) return null;

  return (rows as FullTransactionRow[])
    .filter((row) => Number(row.quantity) > 0)
    .map((row) => ({
      symbol: row.symbol.toUpperCase().trim(),
      side: row.side,
      quantity: Number(row.quantity),
      priceUsd: Number(row.price_usd) || 0,
      executedAt: row.executed_at,
    }));
}

export async function upsertPortfolioAssetPriceCache(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  assets: Array<{ symbol: string; quantity: number; avgBuyPriceUsd: number; priceUsd: number }>
): Promise<void> {
  if (assets.length === 0) {
    return;
  }

  const timestamp = new Date().toISOString();
  const rows = assets
    .filter((asset) => asset.quantity > 0)
    .map((asset) => ({
      user_id: userId,
      portfolio_id: portfolioId,
      symbol: asset.symbol,
      quantity: asset.quantity,
      avg_buy_price_usd: asset.avgBuyPriceUsd,
      last_price_usd: asset.priceUsd,
      last_synced_at: timestamp
    }));

  if (rows.length === 0) {
    return;
  }

  await supabase.from("portfolio_assets").upsert(rows, { onConflict: "portfolio_id,symbol" });
}
