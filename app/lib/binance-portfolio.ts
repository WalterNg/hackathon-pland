import {
  type Binance24hrTicker,
  type PortfolioAssetRow,
  type PortfolioChartPoint,
  type PortfolioPosition,
  type PortfolioSnapshot,
  type PortfolioTransaction,
} from "./portfolio-types";
import { calculateMaxDrawdownDetail, calculateRiskMetricsFromPortfolio, calculateVolatilityFromSeries } from "./risk-calculator";
import { backendBaseUrl } from "./backend-base-url";

// demo-api.binance.com returns HTTP 451 (geo-blocked) from Vercel/AWS IPs.
// All market data is proxied through the GCP backend to avoid the block.
function marketUrl(path: string): string {
  return `${backendBaseUrl()}/api/binance/market/${path}`;
}
const KLINE_HISTORY_DAYS = 35;   // fallback depth when no transaction history exists
const KLINE_INTRADAY_HOURS = 24;
const KLINE_MAX_LIMIT = 1000;    // Binance API max — covers ~2.7 years of daily candles
const BACKFILL_WINDOW_MS = 24 * 60 * 60 * 1000; // 1-day pre-inception context window

type Kline = {
  openTime: number;
  openPrice: number;
  closePrice: number;
};

type PriceMap = Record<string, number>;
type Change24hMap = Record<string, number>;
type VolumeMap = Record<string, number>;
type KlinesMap = Record<string, Kline[]>;

type DailyOpenMetrics = {
  dailyOpenAt: string | null;
  dailyOpenValueUsd: number | null;
  dailyLossUsd: number | null;
};

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

function getLatestDailyOpenPrice(klines: Kline[]): number | null {
  const latestKline = klines[klines.length - 1];
  if (!latestKline || latestKline.openPrice <= 0) {
    return null;
  }

  return latestKline.openPrice;
}

function calculateDailyOpenMetrics(
  assets: Array<Pick<PortfolioAssetRow, "symbol" | "quantity" | "priceUsd" | "dailyOpenPriceUsd">>,
  dailyOpenAt: string | null,
  currentValueUsd: number
): DailyOpenMetrics {
  if (assets.length === 0) {
    return {
      dailyOpenAt,
      dailyOpenValueUsd: 0,
      dailyLossUsd: 0,
    };
  }

  let isBaselineComplete = true;
  const dailyOpenValueUsdRaw = assets.reduce((sum, asset) => {
    const baselinePriceUsd = asset.dailyOpenPriceUsd;
    if (baselinePriceUsd === null || baselinePriceUsd === undefined) {
      if (!STABLE_ASSET_SYMBOLS.has(baseAssetFromSymbol(asset.symbol))) {
        isBaselineComplete = false;
      }
      return sum + asset.quantity * asset.priceUsd;
    }

    return sum + asset.quantity * baselinePriceUsd;
  }, 0);

  if (!isBaselineComplete) {
    return {
      dailyOpenAt,
      dailyOpenValueUsd: null,
      dailyLossUsd: null,
    };
  }

  return {
    dailyOpenAt,
    dailyOpenValueUsd: round(dailyOpenValueUsdRaw),
    dailyLossUsd: round(Math.max(0, dailyOpenValueUsdRaw - currentValueUsd)),
  };
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

  const url = `${marketUrl("tickers")}?symbols=${encodeURIComponent(symbols.join(","))}`;
  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      console.error("[binance] ticker fetch failed", { status: response.status, url });
      return fallback;
    }

    const data = (await response.json()) as { tickers: Record<string, Binance24hrTicker> };
    return { ...fallback, ...data.tickers };
  } catch (err) {
    console.error("[binance] ticker fetch threw", { url, error: String(err) });
    return fallback;
  }
}

async function fetchSymbolKlines(symbol: string, startTimeMs?: number): Promise<Kline[]> {
  const params = new URLSearchParams({ symbol, interval: "1d", limit: String(KLINE_MAX_LIMIT) });
  if (startTimeMs != null) params.set("startTime", String(startTimeMs));
  const url = `${marketUrl("klines")}?${params}`;
  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      console.error("[binance] klines fetch failed", { status: response.status, symbol, url });
      return [];
    }

    const data = (await response.json()) as { klines: Kline[] };
    return data.klines ?? [];
  } catch (err) {
    console.error("[binance] klines fetch threw", { symbol, url, error: String(err) });
    return [];
  }
}

async function fetchKlinesAll(symbols: string[], startTimeMs?: number): Promise<KlinesMap> {
  if (symbols.length === 0) return {};

  const entries = await Promise.all(
    symbols.map(async (symbol) => [symbol, await fetchSymbolKlines(symbol, startTimeMs)] as const)
  );

  const out = {} as KlinesMap;
  for (const [symbol, klines] of entries) out[symbol] = klines;
  return out;
}

async function fetchSymbolHourlyKlines(symbol: string): Promise<Kline[]> {
  const params = new URLSearchParams({ symbol, interval: "1h", limit: String(KLINE_INTRADAY_HOURS) });
  const url = `${marketUrl("klines")}?${params}`;
  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      console.error("[binance] hourly klines fetch failed", { status: response.status, symbol, url });
      return [];
    }

    const data = (await response.json()) as { klines: Kline[] };
    return data.klines ?? [];
  } catch (err) {
    console.error("[binance] hourly klines fetch threw", { symbol, url, error: String(err) });
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

    const dailyReturn = i > 0 && points[i - 1] && points[i - 1].totalValueUsd > 0
      ? (total - points[i - 1].totalValueUsd) / points[i - 1].totalValueUsd
      : null;

    points.push({
      time: pointTime,
      totalValueUsd: round(total),
      btcPriceUsd: btcPriceUsd ? round(btcPriceUsd, 2) : null,
      costBasisUsd: null,
      dailyReturn: dailyReturn !== null ? round(dailyReturn, 6) : null,
    });
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

  let prevHoldings: HoldingsEntry[] = [];
  let prevTotalValueUsd = 0;

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
      let dailyReturn: number | null = null;
      if (prevTotalValueUsd > 0 && prevHoldings.length > 0) {
        let prevValueAtCurrentPrices = 0;
        for (const { symbol, quantity } of prevHoldings) {
          const price = priceLookup.get(symbol)?.get(ts) ?? prices[symbol] ?? 0;
          prevValueAtCurrentPrices += quantity * price;
        }
        dailyReturn = (prevValueAtCurrentPrices - prevTotalValueUsd) / prevTotalValueUsd;
      }

      const btcPriceUsd = btcByTime.get(ts) ?? prices[BTC_USDT_SYMBOL] ?? null;
      const costBasisUsd = isBackfill ? null : getCostBasisAt(costBasisTimeline, ts);
      points.push({
        time: new Date(ts).toISOString(),
        totalValueUsd: round(total),
        btcPriceUsd: btcPriceUsd ? round(btcPriceUsd, 2) : null,
        costBasisUsd: costBasisUsd !== null ? round(costBasisUsd) : null,
        dailyReturn: dailyReturn !== null ? round(dailyReturn, 6) : null,
      });

      prevHoldings = holdings;
      prevTotalValueUsd = total;
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
        bestPerformerAllTime: null,
        worstPerformerAllTime: null,
        maxDrawdownPercent: 0,
        volatilityPercent: 0,
        concentrationIndex: 0,
        sharpeRatio7d: null,
        sharpeRatio30d: null,
        sharpeRatio90d: null,
        downsideRiskPercent: 0,
        riskScore: 0,
        volatilityPercentile: 0,
        expectedShortfallPercent: 0,
        beta: 0,
        breachPenaltyScore: 0,
        violatedRulesCount: 0,
        lastRiskUpdatedAt: new Date().toISOString(),
        dailyOpenValueUsd: 0,
        dailyLossUsd: 0,
        dailyOpenAt: null,
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
    const dailyOpenPriceUsd = getLatestDailyOpenPrice(dailyKlinesMap[symbol] ?? []);
    const valueUsd = position.quantity * priceUsd;
    const costUsd = position.quantity * position.avgBuyPriceUsd;
    const pnlUsd = valueUsd - costUsd;
    const pnlPercent = costUsd > 0 ? (pnlUsd / costUsd) * 100 : 0;

    return {
      symbol,
      quantity: position.quantity,
      avgBuyPriceUsd: round(position.avgBuyPriceUsd, 8),
      priceUsd: round(priceUsd, 8),
      dailyOpenPriceUsd: dailyOpenPriceUsd !== null ? round(dailyOpenPriceUsd, 8) : null,
      valueUsd: round(valueUsd),
      change24hPercent: round(changes24h[symbol] ?? 0),
      change7dPercent: round(get7dChangePercent(dailyKlinesMap[symbol] ?? [])),
      pnlUsd: round(pnlUsd),
      pnlPercent: round(pnlPercent),
      volume24hUsd: round(volumes24h[symbol]),
    };
  });

  const totalValueUsd = round(totalValueUsdRaw);
  const latestDailyOpenTimeMs = heldSymbols
    .map((symbol) => {
      const klines = dailyKlinesMap[symbol] ?? [];
      return klines[klines.length - 1]?.openTime ?? null;
    })
    .find((openTime): openTime is number => openTime !== null) ?? null;
  const dailyOpenAt = latestDailyOpenTimeMs !== null ? new Date(latestDailyOpenTimeMs).toISOString() : null;

  const assets: PortfolioAssetRow[] = assetsBase.map((asset) => ({
    ...asset,
    allocationPercent: totalValueUsdRaw > 0 ? round((asset.valueUsd / totalValueUsdRaw) * 100) : 0,
  }));
  const dailyOpenMetrics = calculateDailyOpenMetrics(assets, dailyOpenAt, totalValueUsdRaw);

  const sortedByAllTime = [...assets]
    .filter((asset) => isPerformerCandidate(asset.symbol))
    .sort((a, b) => b.pnlPercent - a.pnlPercent);
  const best = sortedByAllTime[0] ?? null;
  const worst = sortedByAllTime[sortedByAllTime.length - 1] ?? null;
  const costBasisTimeline = buildCostBasisTimeline(transactions);
  const chart = holdingsTimeline.length > 0
    ? buildChartFromTimeline(klinesMap, prices, holdingsTimeline, effectiveStartMs, firstTransactionMs, costBasisTimeline)
    : buildChartLegacy(heldSymbols, klinesMap, prices, positions);

  // Calculate top risk contributor based on weight * standalone volatility
  let topRiskContributorSymbol: string | null = null;
  let topRiskContributorPercent: number | null = null;
  if (assets.length > 0) {
    let totalWeightedVol = 0;
    const weightedVols = assets.map((asset) => {
      const klines = dailyKlinesMap[asset.symbol] ?? [];
      const closePrices = klines.map((k) => k.closePrice);
      const assetVol = calculateVolatilityFromSeries(closePrices);
      const weightedVol = (asset.allocationPercent / 100) * assetVol;
      totalWeightedVol += weightedVol;
      return { symbol: asset.symbol, weightedVol };
    });

    const contributors = weightedVols.map((w) => ({
      symbol: w.symbol,
      percent: totalWeightedVol > 0 ? (w.weightedVol / totalWeightedVol) * 100 : 0,
    })).sort((a, b) => b.percent - a.percent);

    if (contributors[0]) {
      topRiskContributorSymbol = contributors[0].symbol;
      topRiskContributorPercent = round(contributors[0].percent, 2);
    }
  }

  const allocationsPercent = assets.map((asset) => asset.allocationPercent);
  const riskMetrics = calculateRiskMetricsFromPortfolio(chart, allocationsPercent, {
    topRiskContributorSymbol,
    topRiskContributorPercent,
  });
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
      bestPerformerAllTime: best
        ? { symbol: best.symbol, pnlUsd: best.pnlUsd, pnlPercent: best.pnlPercent }
        : null,
      worstPerformerAllTime: worst
        ? { symbol: worst.symbol, pnlUsd: worst.pnlUsd, pnlPercent: worst.pnlPercent }
        : null,
      maxDrawdownPercent: riskMetrics.maxDrawdownPercent,
      maxDrawdownDetail,
      volatilityPercent: riskMetrics.volatilityPercent,
      concentrationIndex: riskMetrics.concentrationIndex,
      sharpeRatio7d: riskMetrics.sharpeRatio7d,
      sharpeRatio30d: riskMetrics.sharpeRatio30d,
      sharpeRatio90d: riskMetrics.sharpeRatio90d,
      downsideRiskPercent: riskMetrics.downsideRiskPercent,
      riskScore: riskMetrics.riskScore,
      volatilityPercentile: riskMetrics.volatilityPercentile,
      expectedShortfallPercent: riskMetrics.expectedShortfallPercent,
      beta: riskMetrics.beta,
      breachPenaltyScore: riskMetrics.breachPenaltyScore,
      sortinoRatio30d: riskMetrics.sortinoRatio30d,
      calmarRatio30d: riskMetrics.calmarRatio30d,
      var95Percent: riskMetrics.var95Percent,
      topRiskContributorSymbol: riskMetrics.topRiskContributorSymbol,
      topRiskContributorPercent: riskMetrics.topRiskContributorPercent,
      dailyOpenValueUsd: dailyOpenMetrics.dailyOpenValueUsd,
      dailyLossUsd: dailyOpenMetrics.dailyLossUsd,
      dailyOpenAt: dailyOpenMetrics.dailyOpenAt,
      violatedRulesCount: 0,
      lastRiskUpdatedAt: riskUpdatedAt,
    },
    chart,
    assets,
  };
}
