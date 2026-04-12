import {
  type Binance24hrTicker,
  type PortfolioAssetRow,
  type PortfolioChartPoint,
  type PortfolioPosition,
  type PortfolioSnapshot,
  type PortfolioTransaction,
} from "./portfolio-types";
import { calculateMaxDrawdownDetail, calculateRiskMetricsFromPortfolio } from "./risk-calculator";

const BINANCE_BASE_URL = "https://api.binance.com";
const KLINE_HISTORY_DAYS = 35;   // fallback depth when no transaction history exists
const KLINE_INTRADAY_HOURS = 24;
const KLINE_MAX_LIMIT = 1000;    // Binance API max — covers ~2.7 years of daily candles
const BACKFILL_WINDOW_MS = 24 * 60 * 60 * 1000; // 1-day pre-inception context window

type Kline = {
  openTime: number;
  closePrice: number;
};

type PriceMap = Record<string, number>;
type Change24hMap = Record<string, number>;
type VolumeMap = Record<string, number>;
type KlinesMap = Record<string, Kline[]>;

// ── Holdings timeline ─────────────────────────────────────────────────────────
// Each snapshot captures the exact portfolio state immediately AFTER a transaction.
// The timeline is sorted ascending by timeMs.

type HoldingsEntry = { symbol: string; quantity: number };
type HoldingsSnapshot = { timeMs: number; entries: HoldingsEntry[] };

/**
 * Build a holdings timeline from raw transactions.
 * Result: one snapshot per transaction, each representing the portfolio state
 * immediately after that transaction was applied.
 */
function buildHoldingsTimeline(transactions: PortfolioTransaction[]): HoldingsSnapshot[] {
  const relevant = transactions.filter((tx) => tx.side !== "fee");
  const sorted = [...relevant].sort(
    (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()
  );

  const positions = new Map<string, number>();
  const timeline: HoldingsSnapshot[] = [];

  for (const tx of sorted) {
    const symbol = tx.symbol.toUpperCase();
    const qty = tx.quantity;
    const current = positions.get(symbol) ?? 0;

    if (tx.side === "buy" || tx.side === "deposit" || tx.side === "airdrop") {
      positions.set(symbol, current + qty);
    } else if (tx.side === "sell" || tx.side === "withdrawal") {
      const next = Math.max(0, current - qty);
      if (next <= 0) positions.delete(symbol);
      else positions.set(symbol, next);
    }

    timeline.push({
      timeMs: new Date(tx.executedAt).getTime(),
      entries: Array.from(positions.entries())
        .filter(([, q]) => q > 0)
        .map(([s, q]) => ({ symbol: s, quantity: q })),
    });
  }

  return timeline;
}

/**
 * Return the holdings state at a given point in time.
 * Returns the last snapshot whose timeMs <= timeMs argument.
 * Returns [] if queried before the first transaction.
 */
function getHoldingsAt(timeline: HoldingsSnapshot[], timeMs: number): HoldingsEntry[] {
  let result: HoldingsEntry[] = [];
  for (const snapshot of timeline) {
    if (snapshot.timeMs <= timeMs) result = snapshot.entries;
    else break;
  }
  return result;
}

type CostBasisSnapshot = { timeMs: number; costBasisUsd: number };

/**
 * Build a running cost-basis timeline from transactions.
 * costBasisUsd at time t = total capital invested minus realized proceeds up to t.
 *   buy  → +qty * priceUsd + feeUsd
 *   sell → -qty * priceUsd + feeUsd  (reduces basis by realized proceeds)
 *   deposit/withdrawal/airdrop → no cost impact
 */
function buildCostBasisTimeline(transactions: PortfolioTransaction[]): CostBasisSnapshot[] {
  const sorted = [...transactions]
    .filter((tx) => tx.side === "buy" || tx.side === "sell")
    .sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime());

  let running = 0;
  return sorted.map((tx) => {
    if (tx.side === "buy") {
      running += tx.quantity * tx.priceUsd;
    } else {
      running -= tx.quantity * tx.priceUsd;
    }
    return { timeMs: new Date(tx.executedAt).getTime(), costBasisUsd: Math.max(0, running) };
  });
}

function getCostBasisAt(timeline: CostBasisSnapshot[], timeMs: number): number | null {
  let result: number | null = null;
  for (const snap of timeline) {
    if (snap.timeMs <= timeMs) result = snap.costBasisUsd;
    else break;
  }
  return result;
}

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const safeNumber = (value: string | number | undefined, fallback = 0): number => {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const BTC_USDT_SYMBOL = "BTCUSDT";
const STABLE_ASSET_SYMBOLS = new Set([
  "USDT",
  "USDC",
  "BUSD",
  "FDUSD",
  "TUSD",
  "USDP",
  "DAI",
  "USDS"
]);

function baseAssetFromSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (normalized.endsWith("USDT") && normalized.length > 4) {
    return normalized.slice(0, -4);
  }

  return normalized;
}

function isPerformerCandidate(symbol: string): boolean {
  return !STABLE_ASSET_SYMBOLS.has(baseAssetFromSymbol(symbol));
}

function normalizePositions(positions?: ReadonlyArray<PortfolioPosition>): ReadonlyArray<PortfolioPosition> {
  if (!positions || positions.length === 0) {
    return [];
  }

  const cleaned = positions.filter((position) => position.quantity > 0);
  return cleaned;
}

const buildFallbackTicker = (symbols: string[], positions: ReadonlyArray<PortfolioPosition>): Record<string, Binance24hrTicker> => {
  const fallback = {} as Record<string, Binance24hrTicker>;
  const costBySymbol = new Map<string, number>();

  for (const position of positions) {
    costBySymbol.set(position.symbol, position.avgBuyPriceUsd);
  }

  for (const symbol of symbols) {
    fallback[symbol] = {
      symbol,
      lastPrice: String(costBySymbol.get(symbol) ?? 0),
      priceChangePercent: "0",
      quoteVolume: "0"
    };
  }

  return fallback;
};

async function fetch24hTickers(
  symbols: string[],
  positions: ReadonlyArray<PortfolioPosition>
): Promise<Record<string, Binance24hrTicker>> {
  const fallback = buildFallbackTicker(symbols, positions);
  if (symbols.length === 0) {
    return fallback;
  }

  const tickerSymbolsQuery = JSON.stringify(symbols);

  try {
    const response = await fetch(
      `${BINANCE_BASE_URL}/api/v3/ticker/24hr?symbols=${encodeURIComponent(tickerSymbolsQuery)}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return fallback;
    }

    const data = (await response.json()) as Binance24hrTicker[];
    const map = { ...fallback };
    const symbolSet = new Set(symbols);

    for (const ticker of data) {
      if (symbolSet.has(ticker.symbol)) {
        map[ticker.symbol] = ticker;
      }
    }

    return map;
  } catch {
    return fallback;
  }
}

async function fetchSymbolKlines(symbol: string, startTimeMs?: number): Promise<Kline[]> {
  try {
    const base = `${BINANCE_BASE_URL}/api/v3/klines?symbol=${symbol}&interval=1d&limit=${KLINE_MAX_LIMIT}`;
    const url = startTimeMs != null ? `${base}&startTime=${startTimeMs}` : `${base}`;
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return [];
    }

    const rows = (await response.json()) as Array<[
      number,
      string,
      string,
      string,
      string,
      string,
      number,
      string,
      number,
      string,
      string,
      string,
    ]>;

    return rows.map((row) => ({
      openTime: row[0],
      closePrice: safeNumber(row[4], 0),
    }));
  } catch {
    return [];
  }
}

async function fetchKlinesAll(symbols: string[], startTimeMs?: number): Promise<KlinesMap> {
  if (symbols.length === 0) {
    return {};
  }

  const entries = await Promise.all(
    symbols.map(async (symbol) => [symbol, await fetchSymbolKlines(symbol, startTimeMs)] as const)
  );

  const out = {} as KlinesMap;
  for (const [symbol, klines] of entries) {
    out[symbol] = klines;
  }
  return out;
}

async function fetchSymbolHourlyKlines(symbol: string): Promise<Kline[]> {
  try {
    const response = await fetch(
      `${BINANCE_BASE_URL}/api/v3/klines?symbol=${symbol}&interval=1h&limit=${KLINE_INTRADAY_HOURS}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return [];
    }

    const rows = (await response.json()) as Array<[
      number, string, string, string, string, string,
      number, string, number, string, string, string,
    ]>;

    return rows.map((row) => ({
      openTime: row[0],
      closePrice: safeNumber(row[4], 0),
    }));
  } catch {
    return [];
  }
}

async function fetchHourlyKlinesAll(symbols: string[]): Promise<KlinesMap> {
  if (symbols.length === 0) {
    return {};
  }

  const entries = await Promise.all(
    symbols.map(async (symbol) => [symbol, await fetchSymbolHourlyKlines(symbol)] as const)
  );

  const out = {} as KlinesMap;
  for (const [symbol, klines] of entries) {
    out[symbol] = klines;
  }
  return out;
}

/**
 * Merge daily and hourly klines for a symbol into a single chronological array.
 *
 * Strategy: keep daily klines whose openTime predates the oldest hourly kline,
 * then append all hourly klines. This eliminates any temporal overlap so the
 * chart transitions smoothly from daily history into intraday resolution.
 */
function mergeKlines(daily: Kline[], hourly: Kline[]): Kline[] {
  if (hourly.length === 0) return daily;
  const oldestHourlyTime = hourly[0].openTime;
  const historicalDaily = daily.filter((k) => k.openTime < oldestHourlyTime);
  return [...historicalDaily, ...hourly];
}

function get7dChangePercent(klines: Kline[]): number {
  if (klines.length < 2) {
    return 0;
  }

  const first = klines[0]?.closePrice ?? 0;
  const last = klines[klines.length - 1]?.closePrice ?? 0;

  if (first <= 0) {
    return 0;
  }

  return ((last - first) / first) * 100;
}

/** Legacy chart builder: projects current positions backward across all klines. */
function buildChartLegacy(
  symbols: string[],
  klinesMap: KlinesMap,
  prices: PriceMap,
  positions: ReadonlyArray<PortfolioPosition>
): PortfolioChartPoint[] {
  if (symbols.length === 0 || positions.length === 0) return [];
  const maxLen = Math.max(...symbols.map((s) => klinesMap[s]?.length ?? 0), 0);
  if (maxLen === 0) return [];

  // Build BTC price lookup by index position (aligned to its own kline array)
  const btcKlines = klinesMap[BTC_USDT_SYMBOL] ?? [];
  const btcByTime = new Map<number, number>();
  for (const k of btcKlines) btcByTime.set(k.openTime, k.closePrice);

  const points: PortfolioChartPoint[] = [];
  for (let i = 0; i < maxLen; i++) {
    let total = 0;
    let pointTime = new Date().toISOString();
    let pointTimeMs = 0;
    for (const pos of positions) {
      const kline = klinesMap[pos.symbol]?.[i];
      const price = kline?.closePrice ?? prices[pos.symbol] ?? 0;
      total += pos.quantity * price;
      if (kline) { pointTime = new Date(kline.openTime).toISOString(); pointTimeMs = kline.openTime; }
    }
    const btcPriceUsd = btcByTime.get(pointTimeMs) ?? prices[BTC_USDT_SYMBOL] ?? null;
    points.push({ time: pointTime, totalValueUsd: round(total), btcPriceUsd: btcPriceUsd ? round(btcPriceUsd, 2) : null, costBasisUsd: null });
  }
  return points;
}

/**
 * Transaction-aware chart builder.
 *
 * Rules:
 * - Points from [effectiveStartMs, firstTransactionMs): backfill region.
 *   Holdings = first transaction's resulting state (contextual market data only).
 * - Points from [firstTransactionMs, now]: reconstructed history.
 *   Holdings change exactly at each transaction timestamp.
 */
function buildChartFromTimeline(
  klinesMap: KlinesMap,
  prices: PriceMap,
  holdingsTimeline: HoldingsSnapshot[],
  effectiveStartMs: number,
  firstTransactionMs: number,
  costBasisTimeline: CostBasisSnapshot[]
): PortfolioChartPoint[] {
  if (holdingsTimeline.length === 0) return [];

  // All symbols that ever appear in any holdings snapshot
  const allSymbols = [...new Set(
    holdingsTimeline.flatMap((s) => s.entries.map((e) => e.symbol))
  )];

  // Pre-build price lookup: symbol → (openTime → closePrice)
  const priceLookup = new Map<string, Map<number, number>>();
  for (const symbol of allSymbols) {
    const m = new Map<number, number>();
    for (const k of klinesMap[symbol] ?? []) m.set(k.openTime, k.closePrice);
    priceLookup.set(symbol, m);
  }

  // Collect all kline timestamps >= effectiveStartMs across every symbol
  const tsSet = new Set<number>();
  for (const symbol of allSymbols) {
    for (const k of klinesMap[symbol] ?? []) {
      if (k.openTime >= effectiveStartMs) tsSet.add(k.openTime);
    }
  }

  const firstHoldings = holdingsTimeline[0].entries; // used for backfill region
  const btcKlines = klinesMap[BTC_USDT_SYMBOL] ?? [];
  const btcByTime = new Map<number, number>();
  for (const k of btcKlines) btcByTime.set(k.openTime, k.closePrice);

  const points: PortfolioChartPoint[] = [];

  for (const ts of [...tsSet].sort((a, b) => a - b)) {
    const isBackfill = ts < firstTransactionMs;
    const holdings = isBackfill ? firstHoldings : getHoldingsAt(holdingsTimeline, ts);
    if (holdings.length === 0) continue;

    let total = 0;
    for (const { symbol, quantity } of holdings) {
      const price = priceLookup.get(symbol)?.get(ts) ?? prices[symbol] ?? 0;
      total += quantity * price;
    }

    if (total > 0) {
      const btcPriceUsd = btcByTime.get(ts) ?? prices[BTC_USDT_SYMBOL] ?? null;
      const costBasisUsd = isBackfill ? null : getCostBasisAt(costBasisTimeline, ts);
      points.push({
        time: new Date(ts).toISOString(),
        totalValueUsd: round(total),
        btcPriceUsd: btcPriceUsd ? round(btcPriceUsd, 2) : null,
        costBasisUsd: costBasisUsd !== null ? round(costBasisUsd) : null,
      });
    }
  }

  return points;
}

export async function buildBinancePortfolioSnapshot(
  name = "Main Portfolio",
  positionsInput?: ReadonlyArray<PortfolioPosition>,
  transactionsInput?: PortfolioTransaction[]
): Promise<PortfolioSnapshot> {
  const positions = normalizePositions(positionsInput);

  if (positions.length === 0) {
    return {
      summary: {
        name,
        baseCurrency: "USD",
        timestamp: new Date().toISOString(),
        totalValueUsd: 0,
        totalValueBtc: 0,
        btcPriceUsd: null
      },
      metrics: {
        totalVolume24hUsd: 0,
        activeAssets: 0,
        totalCostBasisUsd: 0,
        allTimeProfitUsd: 0,
        allTimeProfitPercent: 0,
        bestPerformer24h: null,
        worstPerformer24h: null,
        maxDrawdownPercent: 0,
        volatilityPercent: 0,
        concentrationIndex: 0,
        sharpeRatio30d: null,
        riskScore: 0,
        violatedRulesCount: 0,
        lastRiskUpdatedAt: new Date().toISOString()
      },
      chart: [],
      assets: []
    };
  }

  // Build transaction-based holdings timeline
  const transactions = transactionsInput ?? [];
  const holdingsTimeline = buildHoldingsTimeline(transactions);

  // Compute effective time boundaries for the chart
  const firstTransactionMs = holdingsTimeline.length > 0
    ? holdingsTimeline[0].timeMs
    : Date.now() - KLINE_HISTORY_DAYS * 86_400_000;
  const effectiveStartMs = firstTransactionMs - BACKFILL_WINDOW_MS;

  const heldSymbols = Array.from(new Set(positions.map((p) => p.symbol.toUpperCase())));
  const tickerSymbols = Array.from(new Set([...heldSymbols, BTC_USDT_SYMBOL]));

  // Include symbols from ALL past transactions (needed for historical reconstruction).
  // Always include BTCUSDT so the BTC benchmark line has real historical price data.
  const allHistoricalSymbols = [...new Set(
    holdingsTimeline.flatMap((s) => s.entries.map((e) => e.symbol))
  )];
  const klineSymbols = [...new Set([...heldSymbols, ...allHistoricalSymbols, BTC_USDT_SYMBOL])];
  // BTC hourly klines needed for the recent intraday portion of the benchmark line
  const hourlySymbols = [...new Set([...heldSymbols, BTC_USDT_SYMBOL])];

  const [tickerMap, dailyKlinesMap, hourlyKlinesMap] = await Promise.all([
    fetch24hTickers(tickerSymbols, positions),
    fetchKlinesAll(klineSymbols, effectiveStartMs),
    fetchHourlyKlinesAll(hourlySymbols),
  ]);

  // Merge: daily history + intraday hourly
  const klinesMap: KlinesMap = {};
  for (const symbol of klineSymbols) {
    const daily = dailyKlinesMap[symbol] ?? [];
    const hourly = hourlySymbols.includes(symbol) ? (hourlyKlinesMap[symbol] ?? []) : [];
    klinesMap[symbol] = mergeKlines(daily, hourly);
  }

  const prices = {} as PriceMap;
  const changes24h = {} as Change24hMap;
  const volumes24h = {} as VolumeMap;

  for (const symbol of tickerSymbols) {
    const ticker = tickerMap[symbol];
    prices[symbol] = safeNumber(ticker?.lastPrice, 0);
    changes24h[symbol] = safeNumber(ticker?.priceChangePercent, 0);
    volumes24h[symbol] = safeNumber(ticker?.quoteVolume, 0);
  }

  const btcUsd = prices[BTC_USDT_SYMBOL] > 0 ? prices[BTC_USDT_SYMBOL] : null;

  const totalCostBasisUsd = positions.reduce(
    (sum, position) => sum + position.quantity * position.avgBuyPriceUsd,
    0
  );

  const totalValueUsdRaw = positions.reduce(
    (sum, position) => sum + position.quantity * (prices[position.symbol] ?? 0),
    0
  );

  const totalVolume24hUsd = positions.reduce(
    (sum, position) => sum + (volumes24h[position.symbol] ?? 0),
    0
  );

  const activeAssets = positions.filter((position) => position.quantity > 0).length;

  const allTimeProfitUsdRaw = totalValueUsdRaw - totalCostBasisUsd;
  const allTimeProfitPercentRaw =
    totalCostBasisUsd > 0 ? (allTimeProfitUsdRaw / totalCostBasisUsd) * 100 : 0;

  const assetsBase: Array<Omit<PortfolioAssetRow, "allocationPercent">> = positions.map((position) => {
    const symbol = position.symbol;
    const priceUsd = prices[symbol] ?? 0;
    const valueUsd = position.quantity * priceUsd;
    const costUsd = position.quantity * position.avgBuyPriceUsd;
    const pnlUsd = valueUsd - costUsd;
    const pnlPercent = costUsd > 0 ? (pnlUsd / costUsd) * 100 : 0;

    return {
      symbol,
      quantity: position.quantity,
      avgBuyPriceUsd: round(position.avgBuyPriceUsd),
      priceUsd: round(priceUsd),
      valueUsd: round(valueUsd),
      change24hPercent: round(changes24h[symbol] ?? 0),
      change7dPercent: round(get7dChangePercent(dailyKlinesMap[symbol] ?? [])),
      pnlUsd: round(pnlUsd),
      pnlPercent: round(pnlPercent),
      volume24hUsd: round(volumes24h[symbol]),
    };
  });

  const totalValueUsd = round(totalValueUsdRaw);

  const assets: PortfolioAssetRow[] = assetsBase.map((asset) => ({
    ...asset,
    allocationPercent: totalValueUsdRaw > 0 ? round((asset.valueUsd / totalValueUsdRaw) * 100) : 0,
  }));

  const sortedBy24h = [...assets]
    .filter((asset) => isPerformerCandidate(asset.symbol))
    .sort((a, b) => b.change24hPercent - a.change24hPercent);
  const best = sortedBy24h[0] ?? null;
  const worst = sortedBy24h[sortedBy24h.length - 1] ?? null;
  const costBasisTimeline = buildCostBasisTimeline(transactions);
  const chart = holdingsTimeline.length > 0
    ? buildChartFromTimeline(klinesMap, prices, holdingsTimeline, effectiveStartMs, firstTransactionMs, costBasisTimeline)
    : buildChartLegacy(heldSymbols, klinesMap, prices, positions);
  const navSeriesUsd = chart.map((point) => point.totalValueUsd);
  const allocationsPercent = assets.map((asset) => asset.allocationPercent);
  const riskMetrics = calculateRiskMetricsFromPortfolio(navSeriesUsd, allocationsPercent);
  const maxDrawdownDetail = calculateMaxDrawdownDetail(chart) ?? undefined;
  const riskUpdatedAt = new Date().toISOString();

  return {
    summary: {
      name,
      baseCurrency: "USD",
      timestamp: new Date().toISOString(),
      totalValueUsd,
      totalValueBtc: btcUsd ? round(totalValueUsdRaw / btcUsd, 8) : null,
      btcPriceUsd: btcUsd ? round(btcUsd, 2) : null,
    },
    metrics: {
      totalVolume24hUsd: round(totalVolume24hUsd),
      activeAssets,
      totalCostBasisUsd: round(totalCostBasisUsd),
      allTimeProfitUsd: round(allTimeProfitUsdRaw),
      allTimeProfitPercent: round(allTimeProfitPercentRaw),
      bestPerformer24h: best
        ? { symbol: best.symbol, change24hPercent: best.change24hPercent }
        : null,
      worstPerformer24h: worst
        ? { symbol: worst.symbol, change24hPercent: worst.change24hPercent }
        : null,
      maxDrawdownPercent: riskMetrics.maxDrawdownPercent,
      maxDrawdownDetail,
      volatilityPercent: riskMetrics.volatilityPercent,
      concentrationIndex: riskMetrics.concentrationIndex,
      sharpeRatio30d: riskMetrics.sharpeRatio30d,
      riskScore: riskMetrics.riskScore,
      violatedRulesCount: 0,
      lastRiskUpdatedAt: riskUpdatedAt,
    },
    chart,
    assets,
  };
}
