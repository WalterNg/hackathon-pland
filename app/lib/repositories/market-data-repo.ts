import type { SupabaseClient } from "@supabase/supabase-js";
import { PORTFOLIO_SYMBOLS } from "../portfolio-types";

const BINANCE_BASE_URL = "https://api.binance.com";
const SYMBOL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_SYMBOL_SORT_RANK = 9999;
const PINNED_SYMBOL_ORDER: string[] = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
] as const;

type ExchangeInfoSymbol = {
  symbol: string;
  status: string;
  isSpotTradingAllowed: boolean;
  baseAsset: string;
  quoteAsset: string;
};

type TickerPriceResponse = {
  symbol?: string;
  price?: string;
};

type MarketSymbolRow = {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  status: string;
  is_spot_trading_allowed: boolean;
  source: string;
  last_synced_at: string;
  sort_rank: number;
};

type MarketPriceRow = {
  symbol: string;
  price_usd: number;
  source: string;
  fetched_at: string;
  expires_at: string;
};

export type MarketSymbolItem = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  isSpotTradingAllowed: boolean;
  source: string;
  lastSyncedAt: string;
  sortRank: number;
};

export type MarketPriceItem = {
  symbol: string;
  priceUsd: number;
  source: string;
  fetchedAt: string;
  expiresAt: string;
  isStale: boolean;
};

export type MarketSymbolsResponse = {
  symbols: MarketSymbolItem[];
  source: "cache" | "live" | "seed";
  refreshedAt: string | null;
};

export type MarketPriceResponse = {
  price: MarketPriceItem | null;
  source: "cache" | "live" | "fallback" | "missing";
};

function nowIso() {
  return new Date().toISOString();
}

function isRecent(isoTimestamp: string, ttlMs: number) {
  const parsed = new Date(isoTimestamp).getTime();
  if (Number.isNaN(parsed)) {
    return false;
  }

  return Date.now() - parsed <= ttlMs;
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function getSymbolSortRank(symbol: string) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const rank = PINNED_SYMBOL_ORDER.indexOf(normalizedSymbol);

  return rank >= 0 ? rank : DEFAULT_SYMBOL_SORT_RANK;
}

function symbolToBaseAsset(symbol: string) {
  const normalized = normalizeSymbol(symbol);
  if (normalized.endsWith("USDT")) {
    return normalized.slice(0, -4);
  }

  return normalized;
}

function mapMarketSymbolRow(row: MarketSymbolRow): MarketSymbolItem {
  return {
    symbol: row.symbol,
    baseAsset: row.base_asset,
    quoteAsset: row.quote_asset,
    status: row.status,
    isSpotTradingAllowed: row.is_spot_trading_allowed,
    source: row.source,
    lastSyncedAt: row.last_synced_at,
    sortRank: Number(row.sort_rank) || DEFAULT_SYMBOL_SORT_RANK
  };
}

function mapMarketPriceRow(row: MarketPriceRow): MarketPriceItem {
  return {
    symbol: row.symbol,
    priceUsd: Number(row.price_usd) || 0,
    source: row.source,
    fetchedAt: row.fetched_at,
    expiresAt: row.expires_at,
    isStale: !isRecent(row.expires_at, 0)
  };
}

function sortMarketSymbols(rows: MarketSymbolItem[]) {
  return [...rows].sort((left, right) => {
    if (left.sortRank !== right.sortRank) {
      return left.sortRank - right.sortRank;
    }

    if (left.baseAsset !== right.baseAsset) {
      return left.baseAsset.localeCompare(right.baseAsset);
    }

    return left.symbol.localeCompare(right.symbol);
  });
}

function splitPinnedSymbols(rows: MarketSymbolItem[]) {
  const pinned = rows.filter((row) => row.sortRank < DEFAULT_SYMBOL_SORT_RANK);
  const others = rows.filter((row) => row.sortRank >= DEFAULT_SYMBOL_SORT_RANK);

  return {
    pinned: sortMarketSymbols(pinned),
    others: sortMarketSymbols(others)
  };
}

function buildPinnedSymbols(rows: MarketSymbolItem[]) {
  const bySymbol = new Map(rows.map((row) => [row.symbol, row]));

  return PINNED_SYMBOL_ORDER.map((symbol, index) => {
    const cached = bySymbol.get(symbol);
    if (cached) {
      return {
        ...cached,
        sortRank: index
      };
    }

    return {
      symbol,
      baseAsset: symbolToBaseAsset(symbol),
      quoteAsset: "USDT",
      status: "TRADING",
      isSpotTradingAllowed: true,
      source: "seed",
      lastSyncedAt: nowIso(),
      sortRank: index
    };
  });
}

function filterMarketSymbols(rows: MarketSymbolItem[], query: string) {
  if (!query) {
    return rows;
  }

  return rows.filter((row) => row.symbol.includes(query) || row.baseAsset.includes(query));
}

function buildSeedSymbols(): MarketSymbolItem[] {
  return PORTFOLIO_SYMBOLS.map((symbol) => ({
    symbol,
    baseAsset: symbolToBaseAsset(symbol),
    quoteAsset: "USDT",
    status: "TRADING",
    isSpotTradingAllowed: true,
    source: "seed",
    lastSyncedAt: nowIso(),
    sortRank: getSymbolSortRank(symbol)
  }));
}

async function fetchLiveSymbols(): Promise<MarketSymbolItem[]> {
  try {
    const response = await fetch(`${BINANCE_BASE_URL}/api/v3/exchangeInfo`, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { symbols?: ExchangeInfoSymbol[] };
    const rows = payload.symbols ?? [];

    return rows
      .filter((item) => item.status === "TRADING" && item.isSpotTradingAllowed)
      .filter((item) => item.quoteAsset === "USDT")
      .map((item) => ({
        symbol: item.symbol,
        baseAsset: item.baseAsset,
        quoteAsset: item.quoteAsset,
        status: item.status,
        isSpotTradingAllowed: item.isSpotTradingAllowed,
        source: "binance",
        lastSyncedAt: nowIso(),
        sortRank: getSymbolSortRank(item.symbol)
      }))
      .slice(0, 1000);
  } catch {
    return [];
  }
}

async function fetchLivePrice(symbol: string): Promise<MarketPriceItem | null> {
  try {
    const response = await fetch(
      `${BINANCE_BASE_URL}/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as TickerPriceResponse;
    const priceUsd = Number(payload.price ?? 0);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      return null;
    }

    const timestamp = nowIso();
    return {
      symbol,
      priceUsd,
      source: "binance",
      fetchedAt: timestamp,
      expiresAt: new Date(Date.now() + PRICE_CACHE_TTL_MS).toISOString(),
      isStale: false
    };
  } catch {
    return null;
  }
}

export async function saveMarketSymbolsCache(
  supabase: SupabaseClient,
  symbols: MarketSymbolItem[]
): Promise<void> {
  if (symbols.length === 0) {
    return;
  }

  const rows = symbols.map((item) => ({
    symbol: item.symbol,
    base_asset: item.baseAsset,
    quote_asset: item.quoteAsset,
    status: item.status,
    is_spot_trading_allowed: item.isSpotTradingAllowed,
    source: item.source,
    last_synced_at: item.lastSyncedAt,
    sort_rank: item.sortRank
  }));

  await supabase.from("market_symbols").upsert(rows, { onConflict: "symbol" });
}

export async function saveMarketPricesCache(
  supabase: SupabaseClient,
  prices: Array<Pick<MarketPriceItem, "symbol" | "priceUsd" | "source" | "fetchedAt" | "expiresAt">>
): Promise<void> {
  if (prices.length === 0) {
    return;
  }

  const rows = prices.map((item) => ({
    symbol: item.symbol,
    price_usd: item.priceUsd,
    source: item.source,
    fetched_at: item.fetchedAt,
    expires_at: item.expiresAt
  }));

  await supabase.from("market_prices").upsert(rows, { onConflict: "symbol" });
}

async function listCachedSymbols(supabase: SupabaseClient): Promise<MarketSymbolItem[]> {
  const { data, error } = await supabase
    .from("market_symbols")
    .select("symbol, base_asset, quote_asset, status, is_spot_trading_allowed, source, last_synced_at, sort_rank")
    .order("sort_rank", { ascending: true })
    .order("base_asset", { ascending: true })
    .order("symbol", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as MarketSymbolRow[]).map(mapMarketSymbolRow);
}

async function getLatestSymbolSyncAt(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from("market_symbols")
    .select("last_synced_at")
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.last_synced_at) {
    return null;
  }

  return data.last_synced_at as string;
}

async function refreshSymbolsCache(supabase: SupabaseClient): Promise<MarketSymbolItem[]> {
  const liveSymbols = await fetchLiveSymbols();
  if (liveSymbols.length === 0) {
    return [];
  }

  await saveMarketSymbolsCache(supabase, liveSymbols);
  return liveSymbols;
}

export async function resolveMarketSymbols(
  supabase: SupabaseClient,
  query: string,
  limit = 300
): Promise<MarketSymbolsResponse> {
  const normalizedQuery = normalizeSymbol(query);
  const cachedSymbols = await listCachedSymbols(supabase);
  const filteredCache = filterMarketSymbols(cachedSymbols, normalizedQuery);
  const sortedFilteredCache = sortMarketSymbols(filteredCache).slice(0, limit);
  const latestSyncAt = await getLatestSymbolSyncAt(supabase);
  const pinnedOnlyCache = buildPinnedSymbols(cachedSymbols).slice(0, limit);
  const shouldRefresh =
    cachedSymbols.length === 0 ||
    !latestSyncAt ||
    !isRecent(latestSyncAt, SYMBOL_CACHE_TTL_MS) ||
    (!normalizedQuery && pinnedOnlyCache.length === 0) ||
    (normalizedQuery.length > 0 && filteredCache.length === 0);

  if (!shouldRefresh) {
    if (!normalizedQuery) {
      return {
        symbols: pinnedOnlyCache,
        source: "cache",
        refreshedAt: latestSyncAt
      };
    }

    return {
      symbols: sortedFilteredCache,
      source: "cache",
      refreshedAt: latestSyncAt
    };
  }

  const liveSymbols = await refreshSymbolsCache(supabase);
  if (liveSymbols.length > 0) {
    const freshFilteredSymbols = filterMarketSymbols(liveSymbols, normalizedQuery);
    const freshCache = sortMarketSymbols(freshFilteredSymbols).slice(0, limit);
    if (freshCache.length > 0) {
      if (!normalizedQuery) {
        return {
          symbols: buildPinnedSymbols(liveSymbols).slice(0, limit),
          source: "live",
          refreshedAt: nowIso()
        };
      }

      return {
        symbols: freshCache,
        source: "live",
        refreshedAt: nowIso()
      };
    }
  }

  const seedSymbols = buildSeedSymbols();
  const fallbackFilteredSymbols = filterMarketSymbols(seedSymbols, normalizedQuery);
  const fallbackSymbols = sortMarketSymbols(fallbackFilteredSymbols).slice(0, limit);
  if (fallbackSymbols.length > 0) {
    if (!normalizedQuery) {
      return {
        symbols: buildPinnedSymbols(seedSymbols).slice(0, limit),
        source: "seed",
        refreshedAt: nowIso()
      };
    }

    return {
      symbols: fallbackSymbols,
      source: "seed",
      refreshedAt: nowIso()
    };
  }

  return {
    symbols: filteredCache,
    source: "cache",
    refreshedAt: latestSyncAt
  };
}

async function getCachedPrice(supabase: SupabaseClient, symbol: string): Promise<MarketPriceItem | null> {
  const normalizedSymbol = normalizeSymbol(symbol);
  const { data, error } = await supabase
    .from("market_prices")
    .select("symbol, price_usd, source, fetched_at, expires_at")
    .eq("symbol", normalizedSymbol)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapMarketPriceRow(data as MarketPriceRow);
}

async function ensurePriceSymbolRow(
  supabase: SupabaseClient,
  symbol: string,
  source: string = "binance"
): Promise<void> {
  const normalizedSymbol = normalizeSymbol(symbol);
  const row = {
    symbol: normalizedSymbol,
    base_asset: symbolToBaseAsset(normalizedSymbol),
    quote_asset: "USDT",
    status: "TRADING",
    is_spot_trading_allowed: true,
    source,
    last_synced_at: nowIso(),
    sort_rank: getSymbolSortRank(normalizedSymbol)
  };

  await supabase.from("market_symbols").upsert(row, { onConflict: "symbol" });
}

async function refreshPriceCache(supabase: SupabaseClient, symbol: string): Promise<MarketPriceItem | null> {
  const normalizedSymbol = normalizeSymbol(symbol);
  const livePrice = await fetchLivePrice(normalizedSymbol);
  if (!livePrice) {
    return null;
  }

  await ensurePriceSymbolRow(supabase, normalizedSymbol);
  await saveMarketPricesCache(supabase, [livePrice]);

  return livePrice;
}

export async function resolveMarketPrice(
  supabase: SupabaseClient,
  symbol: string,
  fallbackPriceUsd: number | null = null
): Promise<MarketPriceResponse> {
  const normalizedSymbol = normalizeSymbol(symbol);
  const cachedPrice = await getCachedPrice(supabase, normalizedSymbol);

  if (cachedPrice && !cachedPrice.isStale) {
    return { price: cachedPrice, source: "cache" };
  }

  const livePrice = await refreshPriceCache(supabase, normalizedSymbol);
  if (livePrice) {
    return { price: livePrice, source: "live" };
  }

  if (cachedPrice) {
    return { price: cachedPrice, source: "cache" };
  }

  if (Number.isFinite(fallbackPriceUsd ?? NaN) && (fallbackPriceUsd ?? 0) > 0) {
    const fallbackPrice = {
      symbol: normalizedSymbol,
      priceUsd: fallbackPriceUsd as number,
      source: "portfolio_snapshot",
      fetchedAt: nowIso(),
      expiresAt: new Date(Date.now() + PRICE_CACHE_TTL_MS).toISOString(),
      isStale: false
    };

    await ensurePriceSymbolRow(supabase, normalizedSymbol, "portfolio_snapshot");
    await saveMarketPricesCache(supabase, [fallbackPrice]);

    return {
      price: fallbackPrice,
      source: "fallback"
    };
  }

  return { price: null, source: "missing" };
}

export async function refreshMarketPricesFromSnapshot(
  supabase: SupabaseClient,
  prices: Array<{ symbol: string; priceUsd: number; source?: string }>
): Promise<void> {
  const timestamp = nowIso();
  const normalizedPrices = prices
    .filter((item) => Number.isFinite(item.priceUsd) && item.priceUsd > 0)
    .map((item) => ({
      symbol: normalizeSymbol(item.symbol),
      priceUsd: item.priceUsd,
      source: item.source ?? "portfolio_snapshot",
      fetchedAt: timestamp,
      expiresAt: new Date(Date.now() + PRICE_CACHE_TTL_MS).toISOString()
    }));

  await saveMarketSymbolsCache(
    supabase,
    normalizedPrices.map((item) => ({
      symbol: item.symbol,
      baseAsset: symbolToBaseAsset(item.symbol),
      quoteAsset: "USDT",
      status: "TRADING",
      isSpotTradingAllowed: true,
      source: item.source,
      lastSyncedAt: timestamp,
      sortRank: getSymbolSortRank(item.symbol)
    }))
  );
  await saveMarketPricesCache(supabase, normalizedPrices);
}
