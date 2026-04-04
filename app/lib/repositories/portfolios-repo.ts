import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortfolioPosition } from "../portfolio-types";
import { getLatestPortfolioSnapshotCache } from "./portfolio-snapshots-repo";
import type { PortfolioMode } from "../portfolio-types";

const MAIN_PORTFOLIO_NAME = "Main Portfolio";
const SETUP_SESSION_TTL_MINUTES = 10;

export type BinanceImportAsset = {
  asset: string;
  quantity: number;
  price_usd: number;
};

export type UserPortfolio = {
  id: string;
  name: string;
  isDefault: boolean;
  mode: PortfolioMode;
  syncStatus?: string | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  totalValueBtc: number | null;
  totalValueUsd: number;
};

type PortfolioRow = {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
};

type PortfolioConnectionRow = {
  portfolio_id: string;
  connection_mode: PortfolioMode;
  sync_status: string | null;
  last_synced_at: string | null;
};

type PortfolioConnectionState = {
  mode: PortfolioMode;
  syncStatus: string | null;
  lastSyncedAt: string | null;
};

type PortfolioSnapshotRow = {
  nav_usd: number | null;
  metadata: unknown;
};

type PortfolioAssetCacheRow = {
  portfolio_id: string;
  quantity: number | null;
  last_price_usd: number | null;
};

type PortfolioSetupSessionRow = {
  idempotency_key: string;
  request_name: string;
  request_mode: PortfolioMode;
  status: "pending" | "completed";
  portfolio_id: string | null;
  expires_at: string;
};

type SetupSessionState = "fresh" | "replay" | "in-progress" | "expired" | "conflict" | "error";

type SetupSessionResult = {
  state: SetupSessionState;
  portfolio?: UserPortfolio | null;
};

function toUserPortfolio(row: PortfolioRow): UserPortfolio {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    mode: "manual",
    createdAt: row.created_at,
    totalValueBtc: null,
    totalValueUsd: 0
  };
}

function normalizeIdempotencyKey(rawKey: string | null | undefined): string | null {
  const key = rawKey?.trim();
  if (!key) {
    return null;
  }

  return key.slice(0, 128);
}

async function reservePortfolioSetupSession(
  supabase: SupabaseClient,
  userId: string,
  idempotencyKey: string,
  requestName: string,
  requestMode: PortfolioMode
): Promise<SetupSessionResult> {
  const now = Date.now();
  const { data: existing, error: existingError } = await supabase
    .from("portfolio_setup_sessions")
    .select("idempotency_key, request_name, request_mode, status, portfolio_id, expires_at")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingError) {
    return { state: "error" };
  }

  const existingSession = existing as PortfolioSetupSessionRow | null;
  if (existingSession) {
    const expiresAt = new Date(existingSession.expires_at).getTime();
    if (Number.isNaN(expiresAt) || expiresAt <= now) {
      return { state: "expired" };
    }

    if (existingSession.request_name !== requestName || existingSession.request_mode !== requestMode) {
      return { state: "conflict" };
    }

    if (existingSession.status === "completed" && existingSession.portfolio_id) {
      const { data: portfolioRow, error: portfolioError } = await supabase
        .from("portfolios")
        .select("id, name, is_default, created_at")
        .eq("user_id", userId)
        .eq("id", existingSession.portfolio_id)
        .maybeSingle();

      if (portfolioError || !portfolioRow?.id) {
        return { state: "error" };
      }

      const portfolio = toUserPortfolio(portfolioRow as PortfolioRow);
      const modes = await fetchPortfolioModes(supabase, userId, [portfolio.id]);
      const connection = modes.get(portfolio.id);
      portfolio.mode = connection?.mode ?? "manual";
      portfolio.syncStatus = connection?.syncStatus ?? null;
      portfolio.lastSyncedAt = connection?.lastSyncedAt ?? null;
      return { state: "replay", portfolio };
    }

    return { state: "in-progress" };
  }

  const expiresAt = new Date(now + SETUP_SESSION_TTL_MINUTES * 60 * 1000).toISOString();
  const { error: insertError } = await supabase.from("portfolio_setup_sessions").insert({
    user_id: userId,
    idempotency_key: idempotencyKey,
    request_name: requestName,
    request_mode: requestMode,
    status: "pending",
    expires_at: expiresAt
  });

  if (insertError) {
    return { state: "error" };
  }

  return { state: "fresh" };
}

async function completePortfolioSetupSession(
  supabase: SupabaseClient,
  userId: string,
  idempotencyKey: string,
  portfolioId: string
): Promise<void> {
  await supabase
    .from("portfolio_setup_sessions")
    .update({
      status: "completed",
      portfolio_id: portfolioId
    })
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey);
}

async function clearPortfolioSetupSession(
  supabase: SupabaseClient,
  userId: string,
  idempotencyKey: string
): Promise<void> {
  await supabase
    .from("portfolio_setup_sessions")
    .delete()
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey);
}

async function fetchPortfolioModes(
  supabase: SupabaseClient,
  userId: string,
  portfolioIds: string[]
): Promise<Map<string, PortfolioConnectionState>> {
  if (portfolioIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("portfolio_connections")
    .select("portfolio_id, connection_mode, sync_status, last_synced_at")
    .eq("user_id", userId)
    .in("portfolio_id", portfolioIds);

  if (error || !data) {
    return new Map();
  }

  const modes = new Map<string, PortfolioConnectionState>();
  for (const row of data as PortfolioConnectionRow[]) {
    modes.set(row.portfolio_id, {
      mode: row.connection_mode,
      syncStatus: row.sync_status,
      lastSyncedAt: row.last_synced_at
    });
  }

  return modes;
}

async function createPortfolioConnection(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string
): Promise<boolean> {
  const { error } = await supabase.from("portfolio_connections").upsert(
    {
      user_id: userId,
      portfolio_id: portfolioId,
      provider: "binance",
      connection_mode: "binance_connected",
      is_read_only: true,
      sync_status: "active"
    },
    { onConflict: "portfolio_id" }
  );

  return !error;
}

async function seedBinanceConnectedPortfolio(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  assets: BinanceImportAsset[]
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const rows = assets
    .filter((asset) => asset.quantity > 0)
    .map((asset) => ({
      user_id: userId,
      portfolio_id: portfolioId,
      symbol: asset.asset.endsWith("USDT") ? asset.asset : `${asset.asset}USDT`,
      side: "deposit",
      quantity: asset.quantity,
      price_usd: asset.price_usd,
      fee_usd: 0,
      source: "binance_connected",
      note: "Imported from Binance connection",
      executed_at: nowIso
    }));

  if (rows.length === 0) {
    return true;
  }

  const { error } = await supabase.from("portfolio_transactions").insert(rows);
  return !error;
}

export async function updatePortfolioConnectionSyncState(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  syncStatus: string,
  lastSyncedAt: string | null
): Promise<boolean> {
  const updates: Record<string, string | null> = {
    sync_status: syncStatus,
    last_synced_at: lastSyncedAt
  };

  const { error } = await supabase
    .from("portfolio_connections")
    .update(updates)
    .eq("user_id", userId)
    .eq("portfolio_id", portfolioId);

  return !error;
}

export async function syncBinancePortfolio(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  assets: BinanceImportAsset[]
): Promise<{ ok: boolean; adjustmentCount: number }> {
  // Fetch current DB positions for this portfolio
  const { data: transactions, error: txError } = await supabase
    .from("portfolio_transactions")
    .select("symbol, side, quantity")
    .eq("user_id", userId)
    .eq("portfolio_id", portfolioId);

  if (txError) {
    return { ok: false, adjustmentCount: 0 };
  }

  type TxRow = { symbol: string; side: string; quantity: number };
  const currentQtyBySymbol = new Map<string, number>();
  for (const row of (transactions ?? []) as TxRow[]) {
    const sym = row.symbol.toUpperCase();
    const qty = Number(row.quantity) || 0;
    const prev = currentQtyBySymbol.get(sym) ?? 0;
    if (row.side === "buy" || row.side === "deposit" || row.side === "airdrop") {
      currentQtyBySymbol.set(sym, prev + qty);
    } else if (row.side === "sell" || row.side === "withdrawal") {
      currentQtyBySymbol.set(sym, Math.max(0, prev - qty));
    }
  }

  const nowIso = new Date().toISOString();
  const adjustmentRows: object[] = [];

  for (const asset of assets) {
    if (asset.quantity <= 0) continue;
    const symbol = asset.asset.endsWith("USDT") ? asset.asset : `${asset.asset}USDT`;
    const currentQty = currentQtyBySymbol.get(symbol.toUpperCase()) ?? 0;
    const delta = asset.quantity - currentQty;

    if (Math.abs(delta) < 1e-12) continue;

    adjustmentRows.push({
      user_id: userId,
      portfolio_id: portfolioId,
      symbol,
      side: delta > 0 ? "deposit" : "withdrawal",
      quantity: Math.abs(delta),
      price_usd: asset.price_usd,
      fee_usd: 0,
      source: "binance_sync",
      note: "Binance balance adjustment (manual sync)",
      executed_at: nowIso,
    });
  }

  if (adjustmentRows.length > 0) {
    const { error: insertError } = await supabase
      .from("portfolio_transactions")
      .insert(adjustmentRows);
    if (insertError) {
      return { ok: false, adjustmentCount: 0 };
    }
  }

  // Update last_synced_at
  await supabase
    .from("portfolio_connections")
    .update({ sync_status: "active", last_synced_at: nowIso })
    .eq("user_id", userId)
    .eq("portfolio_id", portfolioId);

  return { ok: true, adjustmentCount: adjustmentRows.length };
}

export async function ensureMainPortfolio(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPortfolio | null> {
  const { data: existingMain, error: mainError } = await supabase
    .from("portfolios")
    .select("id, name, is_default, created_at")
    .eq("user_id", userId)
    .eq("name", MAIN_PORTFOLIO_NAME)
    .maybeSingle();

  if (!mainError && existingMain?.id) {
    if (!existingMain.is_default) {
      const { data: updatedMain } = await supabase
        .from("portfolios")
        .update({ is_default: true })
        .eq("id", existingMain.id)
        .eq("user_id", userId)
        .select("id, name, is_default, created_at")
        .maybeSingle();

      if (updatedMain) {
        return toUserPortfolio(updatedMain as PortfolioRow);
      }
    }

    return toUserPortfolio(existingMain as PortfolioRow);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("portfolios")
    .insert({
      user_id: userId,
      name: MAIN_PORTFOLIO_NAME,
      is_default: true
    })
    .select("id, name, is_default, created_at")
    .maybeSingle();

  if (insertError || !inserted?.id) {
    return null;
  }

  return toUserPortfolio(inserted as PortfolioRow);
}

export async function listUserPortfolios(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPortfolio[]> {
  await ensureMainPortfolio(supabase, userId);

  const { data, error } = await supabase
    .from("portfolios")
    .select("id, name, is_default, created_at")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  const basePortfolios = (data as PortfolioRow[]).map(toUserPortfolio);
  const portfolioIds = basePortfolios.map((portfolio) => portfolio.id);
  const modes = await fetchPortfolioModes(supabase, userId, portfolioIds);
  const { data: rawAssetRows } = await supabase
    .from("portfolio_assets")
    .select("portfolio_id, quantity, last_price_usd")
    .eq("user_id", userId)
    .in("portfolio_id", portfolioIds);

  const assetRows = (rawAssetRows ?? []) as PortfolioAssetCacheRow[];
  const portfolioTotalsFromAssets = new Map<string, number>();
  for (const row of assetRows) {
    const quantity = typeof row.quantity === "number" && Number.isFinite(row.quantity) ? row.quantity : 0;
    const lastPriceUsd = typeof row.last_price_usd === "number" && Number.isFinite(row.last_price_usd) ? row.last_price_usd : 0;
    if (!row.portfolio_id || quantity <= 0 || lastPriceUsd < 0) {
      continue;
    }

    const runningTotal = portfolioTotalsFromAssets.get(row.portfolio_id) ?? 0;
    portfolioTotalsFromAssets.set(row.portfolio_id, runningTotal + quantity * lastPriceUsd);
  }

  const portfoliosWithTotals = await Promise.all(
    basePortfolios.map(async (portfolio) => {
      const snapshot = await getLatestPortfolioSnapshotCache(supabase, userId, portfolio.id);
      const { data: rawSnapshotRows } = await supabase
        .from("portfolio_snapshots")
        .select("nav_usd, metadata")
        .eq("user_id", userId)
        .eq("portfolio_id", portfolio.id)
        .order("snapshot_at", { ascending: false })
        .limit(1);
      const rawSnapshot = (rawSnapshotRows?.[0] as PortfolioSnapshotRow | undefined) ?? null;
      const metadataSummary = rawSnapshot?.metadata && typeof rawSnapshot.metadata === "object"
        ? (rawSnapshot.metadata as { summary?: { totalValueUsd?: number } }).summary
        : undefined;
      const totalValueUsd =
        (typeof rawSnapshot?.nav_usd === "number" && Number.isFinite(rawSnapshot.nav_usd))
          ? rawSnapshot.nav_usd
          : (typeof metadataSummary?.totalValueUsd === "number" && Number.isFinite(metadataSummary.totalValueUsd))
            ? metadataSummary.totalValueUsd
            : portfolioTotalsFromAssets.get(portfolio.id) ?? 0;
      const connection = modes.get(portfolio.id);

      return {
        ...portfolio,
        mode: connection?.mode ?? "manual",
        syncStatus: connection?.syncStatus ?? null,
        lastSyncedAt: connection?.lastSyncedAt ?? null,
        totalValueBtc: snapshot?.summary.totalValueBtc ?? null,
        totalValueUsd
      };
    })
  );

  return portfoliosWithTotals;
}

export async function createUserPortfolio(
  supabase: SupabaseClient,
  userId: string,
  inputName: string,
  inputMode: PortfolioMode = "manual",
  rawIdempotencyKey?: string,
  binanceAssets?: BinanceImportAsset[]
): Promise<{
  portfolio: UserPortfolio | null;
  errorCode: "invalid-name" | "duplicate" | "unknown" | "idempotency-conflict" | "idempotency-expired" | "idempotency-in-progress" | null;
  isReplay: boolean;
}> {
  const name = inputName.trim();
  const idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);

  if (!name) {
    return { portfolio: null, errorCode: "invalid-name", isReplay: false };
  }

  if (inputMode === "binance_connected" && idempotencyKey) {
    const session = await reservePortfolioSetupSession(supabase, userId, idempotencyKey, name, inputMode);

    if (session.state === "replay") {
      return { portfolio: session.portfolio ?? null, errorCode: null, isReplay: true };
    }

    if (session.state === "conflict") {
      return { portfolio: null, errorCode: "idempotency-conflict", isReplay: false };
    }

    if (session.state === "expired") {
      return { portfolio: null, errorCode: "idempotency-expired", isReplay: false };
    }

    if (session.state === "in-progress") {
      return { portfolio: null, errorCode: "idempotency-in-progress", isReplay: false };
    }

    if (session.state === "error") {
      return { portfolio: null, errorCode: "unknown", isReplay: false };
    }
  }

  await ensureMainPortfolio(supabase, userId);

  const { data, error } = await supabase
    .from("portfolios")
    .insert({
      user_id: userId,
      name,
      is_default: false
    })
    .select("id, name, is_default, created_at")
    .maybeSingle();

  if (error || !data?.id) {
    const message = `${(error as { message?: string } | null)?.message ?? ""}`.toLowerCase();
    if (message.includes("duplicate") || message.includes("unique")) {
      if (inputMode === "binance_connected") {
        const existingPortfolio = await resolveUserPortfolioByName(supabase, userId, name);
        if (existingPortfolio?.mode === "binance_connected") {
          if (idempotencyKey) {
            await completePortfolioSetupSession(supabase, userId, idempotencyKey, existingPortfolio.id);
          }
          return { portfolio: existingPortfolio, errorCode: null, isReplay: true };
        }
      }

      return { portfolio: null, errorCode: "duplicate", isReplay: false };
    }

    if (idempotencyKey) {
      await clearPortfolioSetupSession(supabase, userId, idempotencyKey);
    }
    return { portfolio: null, errorCode: "unknown", isReplay: false };
  }

  if (inputMode === "binance_connected") {
    const connectionCreated = await createPortfolioConnection(supabase, userId, data.id as string);
    const assetsToSeed = binanceAssets ?? [];
    const seeded = connectionCreated
      ? await seedBinanceConnectedPortfolio(supabase, userId, data.id as string, assetsToSeed)
      : false;

    if (!connectionCreated || !seeded) {
      await supabase
        .from("portfolios")
        .delete()
        .eq("id", data.id as string)
        .eq("user_id", userId);
      if (idempotencyKey) {
        await clearPortfolioSetupSession(supabase, userId, idempotencyKey);
      }
      return { portfolio: null, errorCode: "unknown", isReplay: false };
    }
  }

  const portfolio = toUserPortfolio(data as PortfolioRow);
  if (inputMode === "binance_connected") {
    portfolio.mode = "binance_connected";
    portfolio.syncStatus = "active";
    portfolio.lastSyncedAt = null;
  }

  if (idempotencyKey && inputMode === "binance_connected") {
    await completePortfolioSetupSession(supabase, userId, idempotencyKey, portfolio.id);
  }

  return { portfolio, errorCode: null, isReplay: false };
}

export async function deleteUserPortfolio(
  supabase: SupabaseClient,
  userId: string,
  inputName: string
): Promise<{ success: boolean; errorCode: "invalid-name" | "default-portfolio" | "not-found" | "unknown" | null }> {
  const name = inputName.trim();
  if (!name) {
    return { success: false, errorCode: "invalid-name" };
  }

  if (name === MAIN_PORTFOLIO_NAME) {
    return { success: false, errorCode: "default-portfolio" };
  }

  const { data: targetPortfolio, error: selectError } = await supabase
    .from("portfolios")
    .select("id, is_default")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();

  if (selectError) {
    return { success: false, errorCode: "unknown" };
  }

  if (!targetPortfolio?.id) {
    return { success: false, errorCode: "not-found" };
  }

  if (targetPortfolio.is_default) {
    return { success: false, errorCode: "default-portfolio" };
  }

  const { error: deleteError } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", targetPortfolio.id)
    .eq("user_id", userId);

  if (deleteError) {
    return { success: false, errorCode: "unknown" };
  }

  return { success: true, errorCode: null };
}

export async function resolveUserPortfolioByName(
  supabase: SupabaseClient,
  userId: string,
  portfolioName: string
): Promise<UserPortfolio | null> {
  const name = portfolioName.trim() || MAIN_PORTFOLIO_NAME;

  if (name === MAIN_PORTFOLIO_NAME) {
    return ensureMainPortfolio(supabase, userId);
  }

  const { data, error } = await supabase
    .from("portfolios")
    .select("id, name, is_default, created_at")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();

  if (error || !data?.id) {
    return null;
  }

  const portfolio = toUserPortfolio(data as PortfolioRow);
  const modes = await fetchPortfolioModes(supabase, userId, [portfolio.id]);
  const connection = modes.get(portfolio.id);
  portfolio.mode = connection?.mode ?? "manual";
  portfolio.syncStatus = connection?.syncStatus ?? null;
  portfolio.lastSyncedAt = connection?.lastSyncedAt ?? null;
  return portfolio;
}

export { MAIN_PORTFOLIO_NAME };
