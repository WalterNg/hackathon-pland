import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardRecentTransaction } from "../portfolio-types";
import { MAIN_PORTFOLIO_NAME } from "./portfolios-repo";

export type PortfolioTransactionSide = "buy" | "sell" | "deposit" | "withdrawal";

export type CreatePortfolioTransactionInput = {
  userId: string;
  portfolioId: string;
  symbol: string;
  side: PortfolioTransactionSide;
  quantity: number;
  priceUsd: number;
  feeUsd?: number;
  note?: string;
  executedAt: string;
};

type PortfolioRow = {
  id: string;
  name: string;
};

type TransactionListRow = {
  id: string;
  symbol: string;
  side: "buy" | "sell" | "deposit" | "withdrawal" | "airdrop" | "fee";
  quantity: number;
  price_usd: number;
  executed_at: string;
  portfolios: Array<{
    name: string;
  }> | null;
};

export type PortfolioTransactionRecord = {
  id: string;
  portfolio_id: string;
  symbol: string;
  side: "buy" | "sell" | "deposit" | "withdrawal" | "airdrop" | "fee";
  quantity: number;
  price_usd: number;
  fee_usd: number;
  note: string | null;
  executed_at: string;
  portfolios: Array<{
    name: string;
  }> | null;
};

export type RealizedSellEvent = {
  id: string;
  portfolioId: string;
  portfolioName: string;
  symbol: string;
  pair: string;
  quantity: number;
  avgBuyPriceUsd: number;
  sellPriceUsd: number;
  realizedPnlUsd: number;
  note: string | null;
  executedAt: string;
};

type PositionState = {
  quantity: number;
  costUsd: number;
};

const round = (value: number, digits = 8): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function symbolToPair(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return "Unknown";
  }

  if (normalized.endsWith("USDT")) {
    return `${normalized.slice(0, -4)}/USDT`;
  }

  if (normalized.endsWith("BUSD")) {
    return `${normalized.slice(0, -4)}/BUSD`;
  }

  if (normalized.endsWith("BTC")) {
    return `${normalized.slice(0, -3)}/BTC`;
  }

  return normalized;
}

export async function createPortfolioTransaction(
  supabase: SupabaseClient,
  input: CreatePortfolioTransactionInput
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("portfolio_transactions")
    .insert({
      user_id: input.userId,
      portfolio_id: input.portfolioId,
      symbol: input.symbol,
      side: input.side,
      quantity: input.quantity,
      price_usd: input.priceUsd,
      fee_usd: input.feeUsd ?? 0,
      note: input.note ?? null,
      source: "manual",
      executed_at: input.executedAt
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    return null;
  }

  return { id: data.id as string };
}

async function resolveTargetPortfolioIds(
  supabase: SupabaseClient,
  userId: string,
  portfolioName: string
): Promise<string[] | null> {
  const normalizedName = portfolioName.trim() || MAIN_PORTFOLIO_NAME;

  if (normalizedName === MAIN_PORTFOLIO_NAME) {
    const { data, error } = await supabase
      .from("portfolios")
      .select("id, name")
      .eq("user_id", userId);

    if (error || !data) {
      return null;
    }

    return (data as PortfolioRow[])
      .filter((portfolio) => portfolio.name !== MAIN_PORTFOLIO_NAME)
      .map((portfolio) => portfolio.id);
  }

  const { data, error } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .eq("name", normalizedName)
    .maybeSingle();

  if (error) {
    return null;
  }

  if (!data?.id) {
    return [];
  }

  return [data.id as string];
}

export async function listRecentTransactions(
  supabase: SupabaseClient,
  userId: string,
  portfolioName: string,
  limit = 6
): Promise<DashboardRecentTransaction[] | null> {
  const targetPortfolioIds = await resolveTargetPortfolioIds(supabase, userId, portfolioName);
  if (!targetPortfolioIds) {
    return null;
  }

  if (targetPortfolioIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("portfolio_transactions")
    .select("id, symbol, side, quantity, price_usd, executed_at, portfolios(name)")
    .eq("user_id", userId)
    .in("portfolio_id", targetPortfolioIds)
    .order("executed_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return null;
  }

  return (data as TransactionListRow[]).map((row) => ({
    id: row.id,
    portfolioName: row.portfolios?.[0]?.name ?? MAIN_PORTFOLIO_NAME,
    symbol: row.symbol,
    side: row.side,
    quantity: Number(row.quantity) || 0,
    priceUsd: Number(row.price_usd) || 0,
    executedAt: row.executed_at
  }));
}

export async function listPortfolioTransactionsSince(
  supabase: SupabaseClient,
  userId: string,
  fromIso: string,
  limit = 500
): Promise<PortfolioTransactionRecord[] | null> {
  const { data, error } = await supabase
    .from("portfolio_transactions")
    .select("id, portfolio_id, symbol, side, quantity, price_usd, fee_usd, note, executed_at, portfolios(name)")
    .eq("user_id", userId)
    .gte("executed_at", fromIso)
    .order("executed_at", { ascending: true })
    .limit(limit);

  if (error || !data) {
    return null;
  }

  return data as PortfolioTransactionRecord[];
}

export async function listAllPortfolioTransactions(
  supabase: SupabaseClient,
  userId: string,
  portfolioName: string,
  limit = 100,
  offset = 0
): Promise<PortfolioTransactionRecord[] | null> {
  const targetPortfolioIds = await resolveTargetPortfolioIds(supabase, userId, portfolioName);
  if (!targetPortfolioIds) return null;
  if (targetPortfolioIds.length === 0) return [];

  const { data, error } = await supabase
    .from("portfolio_transactions")
    .select("id, portfolio_id, symbol, side, quantity, price_usd, fee_usd, note, executed_at, portfolios(name)")
    .eq("user_id", userId)
    .in("portfolio_id", targetPortfolioIds)
    .order("executed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return null;
  return data as PortfolioTransactionRecord[];
}

export async function deletePortfolioTransaction(
  supabase: SupabaseClient,
  userId: string,
  transactionId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("portfolio_transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", userId);

  return !error;
}

export type UpdatePortfolioTransactionInput = {
  quantity?: number;
  priceUsd?: number;
  feeUsd?: number;
  note?: string | null;
  executedAt?: string;
};

export async function updatePortfolioTransaction(
  supabase: SupabaseClient,
  userId: string,
  transactionId: string,
  input: UpdatePortfolioTransactionInput
): Promise<boolean> {
  const patch: Record<string, unknown> = {};
  if (input.quantity != null)   patch.quantity    = input.quantity;
  if (input.priceUsd != null)   patch.price_usd   = input.priceUsd;
  if (input.feeUsd != null)     patch.fee_usd     = input.feeUsd;
  if ("note" in input)          patch.note        = input.note ?? null;
  if (input.executedAt != null) patch.executed_at = input.executedAt;

  if (Object.keys(patch).length === 0) return true;

  const { error } = await supabase
    .from("portfolio_transactions")
    .update(patch)
    .eq("id", transactionId)
    .eq("user_id", userId);

  return !error;
}

export async function listRealizedSellEventsSince(
  supabase: SupabaseClient,
  userId: string,
  fromIso: string,
  limit = 1000
): Promise<RealizedSellEvent[] | null> {
  const transactions = await listPortfolioTransactionsSince(supabase, userId, fromIso, limit);
  if (!transactions) {
    return null;
  }

  const states = new Map<string, PositionState>();
  const events: RealizedSellEvent[] = [];

  for (const transaction of transactions) {
    const side = transaction.side;
    if (side !== "buy" && side !== "sell") {
      continue;
    }

    const quantity = Number(transaction.quantity) || 0;
    const priceUsd = Number(transaction.price_usd) || 0;
    const feeUsd = Number(transaction.fee_usd) || 0;
    if (quantity <= 0 || priceUsd <= 0) {
      continue;
    }

    const symbol = transaction.symbol.trim().toUpperCase();
    const stateKey = `${transaction.portfolio_id}::${symbol}`;
    const state = states.get(stateKey) ?? { quantity: 0, costUsd: 0 };

    if (side === "buy") {
      state.quantity += quantity;
      state.costUsd += quantity * priceUsd + feeUsd;
      states.set(stateKey, state);
      continue;
    }

    if (state.quantity <= 0 || state.costUsd <= 0) {
      continue;
    }

    const sellQuantity = Math.min(quantity, state.quantity);
    const avgBuyPrice = state.costUsd / state.quantity;
    const costRemoved = avgBuyPrice * sellQuantity;
    const proceeds = sellQuantity * priceUsd;
    const realizedPnlUsd = proceeds - costRemoved - feeUsd;

    state.quantity = Math.max(0, state.quantity - sellQuantity);
    state.costUsd = Math.max(0, state.costUsd - costRemoved);
    states.set(stateKey, state);

    events.push({
      id: transaction.id,
      portfolioId: transaction.portfolio_id,
      portfolioName: transaction.portfolios?.[0]?.name ?? MAIN_PORTFOLIO_NAME,
      symbol,
      pair: symbolToPair(symbol),
      quantity: round(sellQuantity, 12),
      avgBuyPriceUsd: round(avgBuyPrice, 8),
      sellPriceUsd: round(priceUsd, 8),
      realizedPnlUsd: round(realizedPnlUsd, 8),
      note: transaction.note,
      executedAt: transaction.executed_at
    });
  }

  return events;
}