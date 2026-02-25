import type { SupabaseClient } from "@supabase/supabase-js";

export type JournalEntryInput = {
  portfolioId?: string;
  pair: string;
  side: "long" | "short" | "spot";
  size: number;
  entryPrice?: number;
  exitPrice?: number;
  pnlUsd?: number;
  pnlPercent?: number;
  strategy?: string;
  notes?: string;
  tags?: string[];
  executedAt: string;
};

export async function createJournalEntry(
  supabase: SupabaseClient,
  userId: string,
  input: JournalEntryInput
) {
  return supabase.from("journal_entries").insert({
    user_id: userId,
    portfolio_id: input.portfolioId ?? null,
    pair: input.pair,
    side: input.side,
    size: input.size,
    entry_price: input.entryPrice ?? null,
    exit_price: input.exitPrice ?? null,
    pnl_usd: input.pnlUsd ?? null,
    pnl_percent: input.pnlPercent ?? null,
    strategy: input.strategy ?? null,
    notes: input.notes ?? null,
    tags: input.tags ?? [],
    executed_at: input.executedAt
  });
}

export type JournalEntryRecord = {
  id: string;
  pair: string;
  side: "long" | "short" | "spot";
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  pnl_usd: number | null;
  notes: string | null;
  emotion: string | null;
  executed_at: string;
};

export async function listJournalEntriesSince(
  supabase: SupabaseClient,
  userId: string,
  fromIso: string,
  limit = 500
): Promise<JournalEntryRecord[] | null> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, pair, side, entry_price, exit_price, stop_loss, take_profit, pnl_usd, notes, emotion, executed_at")
    .eq("user_id", userId)
    .gte("executed_at", fromIso)
    .order("executed_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return null;
  }

  return data as JournalEntryRecord[];
}
