import {
  type Binance24hrTicker,
  type PortfolioAssetRow,
  type PortfolioChartPoint,
  type PortfolioPosition,
  type PortfolioSnapshot,
} from "./portfolio-types";
import { calculateRiskMetricsFromPortfolio } from "./risk-calculator";

const BINANCE_BASE_URL = "https://api.binance.com";
const KLINE_HISTORY_DAYS = 35;
const KLINE_INTRADAY_HOURS = 24;

type Kline = {
  openTime: number;
  closePrice: number;
};

type PriceMap = Record<string, number>;
type Change24hMap = Record<string, number>;
type VolumeMap = Record<string, number>;
type KlinesMap = Record<string, Kline[]>;

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

async function fetchSymbolKlines(symbol: string): Promise<Kline[]> {
  try {
    const response = await fetch(
      `${BINANCE_BASE_URL}/api/v3/klines?symbol=${symbol}&interval=1d&limit=${KLINE_HISTORY_DAYS}`,
      { cache: "no-store" }
    );

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

async function fetchKlinesAll(symbols: string[]): Promise<KlinesMap> {
  if (symbols.length === 0) {
    return {};
  }

  const entries = await Promise.all(
    symbols.map(async (symbol) => [symbol, await fetchSymbolKlines(symbol)] as const)
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

function buildChart(
  symbols: string[],
  klinesMap: KlinesMap,
  prices: PriceMap,
  positions: ReadonlyArray<PortfolioPosition>
): PortfolioChartPoint[] {
  if (symbols.length === 0 || positions.length === 0) {
    return [];
  }

  const maxLen = Math.max(...symbols.map((symbol) => klinesMap[symbol]?.length ?? 0), 0);

  if (maxLen === 0) {
    return [];
  }

  const points: PortfolioChartPoint[] = [];

  for (let i = 0; i < maxLen; i += 1) {
    let total = 0;
    let pointTime = new Date().toISOString();

    for (const position of positions) {
      const kline = klinesMap[position.symbol]?.[i];
      const closePrice = kline?.closePrice ?? prices[position.symbol] ?? 0;
      total += position.quantity * closePrice;
      if (kline) {
        pointTime = new Date(kline.openTime).toISOString();
      }
    }

    points.push({
      time: pointTime,
      totalValueUsd: round(total),
    });
  }

  return points;
}

export async function buildBinancePortfolioSnapshot(
  name = "Main Portfolio",
  positionsInput?: ReadonlyArray<PortfolioPosition>
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

  const heldSymbols = Array.from(new Set(positions.map((position) => position.symbol.toUpperCase())));
  const tickerSymbols = Array.from(new Set([...heldSymbols, BTC_USDT_SYMBOL]));

  const [tickerMap, dailyKlinesMap, hourlyKlinesMap] = await Promise.all([
    fetch24hTickers(tickerSymbols, positions),
    fetchKlinesAll(heldSymbols),
    fetchHourlyKlinesAll(heldSymbols),
  ]);

  // Merge: daily history + intraday hourly resolution for the last 24h
  const klinesMap: KlinesMap = {};
  for (const symbol of heldSymbols) {
    klinesMap[symbol] = mergeKlines(
      dailyKlinesMap[symbol] ?? [],
      hourlyKlinesMap[symbol] ?? []
    );
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
  const chart = buildChart(heldSymbols, klinesMap, prices, positions);
  const navSeriesUsd = chart.map((point) => point.totalValueUsd);
  const allocationsPercent = assets.map((asset) => asset.allocationPercent);
  const riskMetrics = calculateRiskMetricsFromPortfolio(navSeriesUsd, allocationsPercent);
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
