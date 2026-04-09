import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortfolioPosition, PortfolioSymbol } from "../portfolio-types";
import { MAIN_PORTFOLIO_NAME } from "./portfolios-repo";

type TransactionRow = {
  symbol: string;
  side: "buy" | "sell" | "deposit" | "withdrawal" | "airdrop" | "fee";
  quantity: number;
  price_usd: number;
};

function toPortfolioSymbol(symbol: string): PortfolioSymbol | null {
  const normalized = symbol.toUpperCase().trim();
  if (!normalized) {
    return null;
  }

  return normalized;
}

export async function getUserPortfolioPositions(
  supabase: SupabaseClient,
  userId: string,
  portfolioName: string
): Promise<PortfolioPosition[] | null> {
  const normalizedName = portfolioName.trim() || MAIN_PORTFOLIO_NAME;
  let targetPortfolioIds: string[] = [];

  if (normalizedName === MAIN_PORTFOLIO_NAME) {
    // "Main Portfolio" is intentionally treated as the aggregate view across
    // all user-created portfolios, excluding the synthetic/default row itself.
    const { data: portfolios, error: portfoliosError } = await supabase
      .from("portfolios")
      .select("id, name")
      .eq("user_id", userId);

    if (portfoliosError || !portfolios) {
      return null;
    }

    targetPortfolioIds = (portfolios as Array<{ id: string; name: string }>)
      .filter((portfolio) => portfolio.name !== MAIN_PORTFOLIO_NAME)
      .map((portfolio) => portfolio.id);
  } else {
    const { data: portfolio, error: portfolioError } = await supabase
      .from("portfolios")
      .select("id")
      .eq("user_id", userId)
      .eq("name", normalizedName)
      .maybeSingle();

    if (portfolioError) {
      return null;
    }

    if (!portfolio?.id) {
      return [];
    }

    targetPortfolioIds = [portfolio.id];
  }

  if (targetPortfolioIds.length === 0) {
    return [];
  }

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
