"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type PortfolioSnapshot } from "@/app/lib/portfolio-types";
import {
  calculateDefaultBreachPenaltyScore,
  calculateRiskMetricsFromPortfolio,
} from "@/app/lib/risk-calculator";
import { backendBaseUrl } from "@/app/lib/backend-base-url";
import { RefreshIntervals } from "@/app/lib/refresh-intervals";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

type UsePortfolioSnapshotResult = {
  snapshot: PortfolioSnapshot | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  snapshotSource: "live" | "cache" | "cache-fallback";
  lastServerSyncAt: string | null;
  lastRealtimeTickAt: string | null;
  isServerSnapshotStale: boolean;
  reload: () => Promise<void>;
};

const DEFAULT_REFRESH_INTERVAL_MS = RefreshIntervals.PORTFOLIO_SNAPSHOT_SYNC_MS;
const BACKGROUND_SYNC_COOLDOWN_MS = 30_000;
const REALTIME_RECONNECT_DELAY_MS = RefreshIntervals.PORTFOLIO_REALTIME_RECONNECT_MS;
const BTC_USDT_SYMBOL = "BTCUSDT";
const PORTFOLIO_CACHE_PREFIX = "portfolio";
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

type BinanceTickerStreamMessage = {
  data?: {
    s?: string;
    c?: string;
    P?: string;
    q?: string;
  };
};

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const safeNumber = (value: string | number | undefined, fallback = 0): number => {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

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

function isRealtimeTickerSymbol(symbol: string): boolean {
  const normalized = symbol.trim().toUpperCase();
  return normalized.endsWith("USDT") && normalized.length > 4;
}

function calculateDailyLossUsd(snapshot: PortfolioSnapshot, totalValueUsdRaw: number): number | null {
  const dailyOpenValueUsd = snapshot.metrics.dailyOpenValueUsd;
  if (dailyOpenValueUsd === null || dailyOpenValueUsd === undefined) {
    return null;
  }

  return round(Math.max(0, dailyOpenValueUsd - totalValueUsdRaw));
}

async function fetchBackendWithSupabaseAuth(path: string, init: RequestInit = {}) {
  const supabase = await createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

function applyRealtimeTicker(
  currentSnapshot: PortfolioSnapshot,
  symbol: string,
  lastPriceUsd: number,
  change24hPercent: number,
  volume24hUsd: number
): PortfolioSnapshot {
  const updatedAssets = currentSnapshot.assets.map((asset) => {
    if (asset.symbol !== symbol) {
      return asset;
    }

    const nextPriceUsd = round(lastPriceUsd, 8);
    const nextValueUsd = round(asset.quantity * nextPriceUsd);
    const costBasisUsd = asset.quantity * asset.avgBuyPriceUsd;
    const nextPnlUsd = round(nextValueUsd - costBasisUsd);
    const nextPnlPercent = costBasisUsd > 0 ? round((nextPnlUsd / costBasisUsd) * 100) : 0;

    return {
      ...asset,
      priceUsd: nextPriceUsd,
      valueUsd: nextValueUsd,
      change24hPercent: round(change24hPercent),
      volume24hUsd: round(volume24hUsd),
      pnlUsd: nextPnlUsd,
      pnlPercent: nextPnlPercent
    };
  });

  const totalValueUsdRaw = updatedAssets.reduce((sum, asset) => sum + asset.valueUsd, 0);
  const totalCostBasisUsd = currentSnapshot.metrics.totalCostBasisUsd;
  const totalVolume24hUsd = round(updatedAssets.reduce((sum, asset) => sum + asset.volume24hUsd, 0));
  const activeAssets = updatedAssets.filter((asset) => asset.quantity > 0).length;
  const dailyLossUsd = calculateDailyLossUsd(currentSnapshot, totalValueUsdRaw);

  const allTimeProfitUsd = round(totalValueUsdRaw - totalCostBasisUsd);
  const allTimeProfitPercent = totalCostBasisUsd > 0 ? round((allTimeProfitUsd / totalCostBasisUsd) * 100) : 0;

  const sortedByAllTime = [...updatedAssets]
    .filter((asset) => isPerformerCandidate(asset.symbol))
    .sort((a, b) => b.pnlPercent - a.pnlPercent);
  const bestPerformer = sortedByAllTime[0] ?? null;
  const worstPerformer = sortedByAllTime[sortedByAllTime.length - 1] ?? null;

  const assetsWithAllocation = updatedAssets.map((asset) => ({
    ...asset,
    allocationPercent: totalValueUsdRaw > 0 ? round((asset.valueUsd / totalValueUsdRaw) * 100) : 0
  }));

  const btcPriceFromAsset = assetsWithAllocation.find((asset) => asset.symbol === BTC_USDT_SYMBOL)?.priceUsd ?? null;
  const btcPrice = symbol === BTC_USDT_SYMBOL ? round(lastPriceUsd) : btcPriceFromAsset ?? currentSnapshot.summary.btcPriceUsd;
  const totalValueUsd = round(totalValueUsdRaw);
  const totalValueBtc = btcPrice && btcPrice > 0 ? round(totalValueUsdRaw / btcPrice, 8) : null;

  const nowIso = new Date().toISOString();
  const chart = [...currentSnapshot.chart];
  const latestPoint = chart[chart.length - 1];

  const livePoint = { time: nowIso, totalValueUsd, btcPriceUsd: btcPrice ?? null, costBasisUsd: latestPoint?.costBasisUsd ?? null };

  if (!latestPoint) {
    chart.push(livePoint);
  } else {
    const latestTime = new Date(latestPoint.time).getTime();
    const nowTime = Date.now();
    if (!Number.isFinite(latestTime) || nowTime - latestTime > 60_000) {
      chart.push(livePoint);
    } else {
      chart[chart.length - 1] = livePoint;
    }
  }

  // Keep enough history: 35 daily klines + ~8 hours of per-minute realtime ticks.
  // The old limit of 90 would start dropping daily klines after just ~55 min of live ticks.
  const chartWindow = chart.slice(-500);
  const breachPenaltyScore = calculateDefaultBreachPenaltyScore(
    currentSnapshot.riskViolations?.length ?? currentSnapshot.metrics.violatedRulesCount ?? 0
  );
  const riskMetrics = calculateRiskMetricsFromPortfolio(
    chartWindow.map((point) => ({
      totalValueUsd: point.totalValueUsd,
      btcPriceUsd: point.btcPriceUsd,
      dailyReturn: point.dailyReturn,
    })),
    assetsWithAllocation.map((asset) => asset.allocationPercent),
    {
      breachPenaltyScore,
      topRiskContributorSymbol: currentSnapshot.metrics.topRiskContributorSymbol,
      topRiskContributorPercent: currentSnapshot.metrics.topRiskContributorPercent,
    }
  );

  return {
    ...currentSnapshot,
    summary: {
      ...currentSnapshot.summary,
      timestamp: nowIso,
      totalValueUsd,
      totalValueBtc,
      btcPriceUsd: btcPrice && btcPrice > 0 ? btcPrice : null
    },
    metrics: {
      ...currentSnapshot.metrics,
      totalVolume24hUsd,
      activeAssets,
      allTimeProfitUsd,
      allTimeProfitPercent,
      bestPerformerAllTime: bestPerformer
        ? { symbol: bestPerformer.symbol, pnlUsd: bestPerformer.pnlUsd, pnlPercent: bestPerformer.pnlPercent }
        : null,
      worstPerformerAllTime: worstPerformer
        ? { symbol: worstPerformer.symbol, pnlUsd: worstPerformer.pnlUsd, pnlPercent: worstPerformer.pnlPercent }
        : null,
      maxDrawdownPercent: riskMetrics.maxDrawdownPercent,
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
      dailyLossUsd,
      lastRiskUpdatedAt: nowIso
    },
    chart: chartWindow,
    assets: assetsWithAllocation
  };
}

export function usePortfolioSnapshot(
  portfolioId: string | null,
  portfolioName: string,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS
): UsePortfolioSnapshotResult {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshotSource, setSnapshotSource] = useState<"live" | "cache" | "cache-fallback">("cache");
  const [lastServerSyncAt, setLastServerSyncAt] = useState<string | null>(null);
  const [lastRealtimeTickAt, setLastRealtimeTickAt] = useState<string | null>(null);
  const [isServerSnapshotStale, setIsServerSnapshotStale] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const isFetchingRef = useRef(false);
  const isBackgroundSyncingRef = useRef(false);
  const lastBackgroundSyncAtRef = useRef(0);
  const snapshotCacheRef = useRef<Record<string, PortfolioSnapshot>>({});
  const lastAutoCertifyKeyRef = useRef<string | null>(null);

  const cacheKeys = useMemo(() => {
    const keys = [
      `${PORTFOLIO_CACHE_PREFIX}:name:${portfolioName}`,
    ];

    if (portfolioId?.trim()) {
      keys.unshift(`${PORTFOLIO_CACHE_PREFIX}:id:${portfolioId.trim()}`);
    }

    return keys;
  }, [portfolioId, portfolioName]);

  const readCachedSnapshot = () => {
    for (const key of cacheKeys) {
      const cached = snapshotCacheRef.current[key];
      if (cached) {
        return cached;
      }
    }

    return null;
  };

  const writeCachedSnapshot = (data: PortfolioSnapshot) => {
    for (const key of cacheKeys) {
      snapshotCacheRef.current[key] = data;
    }
  };

  const triggerAutoCertify = useCallback(async (payload: PortfolioSnapshot) => {
    const snapshotKey = `${portfolioName}:${payload.summary.timestamp}`;
    if (lastAutoCertifyKeyRef.current === snapshotKey) {
      return;
    }
    lastAutoCertifyKeyRef.current = snapshotKey;

    try {
      await fetchBackendWithSupabaseAuth("/api/portfolio_achievements/auto_certify", {
        method: "POST",
        body: JSON.stringify({
          portfolioId: portfolioId ?? undefined,
          portfolioName,
          snapshotPayload: payload,
        }),
      });
    } catch {
      // best-effort background trigger
    }
  }, [portfolioId, portfolioName]);

  const clearCachedSnapshot = () => {
    for (const key of cacheKeys) {
      delete snapshotCacheRef.current[key];
    }
  };

  const streamSymbols = useMemo(() => {
    const symbolSet = new Set(
      (snapshot?.assets ?? [])
        .map((asset) => asset.symbol.trim().toUpperCase())
        .filter(isRealtimeTickerSymbol)
    );
    symbolSet.add(BTC_USDT_SYMBOL);
    return Array.from(symbolSet).sort();
  }, [snapshot?.assets]);

  const streamSymbolsKey = useMemo(() => streamSymbols.join("|"), [streamSymbols]);

  useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();

    const cachedSnapshot = readCachedSnapshot();
    setSnapshot(cachedSnapshot);
    setLoading(!cachedSnapshot);
    setError(null);
    setSnapshotSource("cache");
    setLastServerSyncAt(cachedSnapshot?.summary.timestamp ?? null);
    setLastRealtimeTickAt(null);
    setIsServerSnapshotStale(false);

    const syncLiveSnapshot = async () => {
      if (isBackgroundSyncingRef.current) {
        return;
      }

      const now = Date.now();
      if (now - lastBackgroundSyncAtRef.current < BACKGROUND_SYNC_COOLDOWN_MS) {
        return;
      }

      isBackgroundSyncingRef.current = true;
      lastBackgroundSyncAtRef.current = now;

      try {
        const response = await fetchWithSupabaseAuth("/api/binance/portfolio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          cache: "no-store",
          signal: abortController.signal,
          body: JSON.stringify({ name: portfolioName })
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as PortfolioSnapshot;
        if (isCancelled) {
          return;
        }

        writeCachedSnapshot(data);
        setSnapshot(data);
        setError(null);
        setSnapshotSource((response.headers.get("x-snapshot-source") as "live" | "cache" | "cache-fallback" | null) ?? "live");
        setLastServerSyncAt(data.summary.timestamp ?? new Date().toISOString());
        setIsServerSnapshotStale(response.headers.get("x-snapshot-stale") === "true");
      } catch {
        return;
      } finally {
        isBackgroundSyncingRef.current = false;
      }
    };

    const loadSnapshot = async (isBackgroundRefresh = false) => {
      if (isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;

      if (!isBackgroundRefresh && !cachedSnapshot) {
        setLoading(true);
      }
      if (isBackgroundRefresh) {
        setRefreshing(true);
      }

      setError(null);

      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 1000;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (isCancelled) break;

        try {
          const response = await fetchWithSupabaseAuth(`/api/binance/portfolio?name=${encodeURIComponent(portfolioName)}`, {
            cache: "no-store",
            signal: abortController.signal
          });

          if (response.status === 404 && attempt < MAX_RETRIES - 1) {
            // Session may not be ready yet — wait and retry
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            continue;
          }

          if (!response.ok) {
            throw new Error(`Failed to load portfolio (${response.status})`);
          }

          const data = (await response.json()) as PortfolioSnapshot;
          const snapshotStale = response.headers.get("x-snapshot-stale") === "true";
          const sourceHeader = (response.headers.get("x-snapshot-source") as "live" | "cache" | "cache-fallback" | null) ?? "cache";
          const portfolioMode = response.headers.get("x-portfolio-mode");
          if (!isCancelled) {
            writeCachedSnapshot(data);
            setSnapshot(data);
            setSnapshotSource(sourceHeader);
            setLastServerSyncAt(data.summary.timestamp ?? new Date().toISOString());
            setIsServerSnapshotStale(snapshotStale);
            void triggerAutoCertify(data);
          }

          if (snapshotStale) {
            void syncLiveSnapshot();
          }

          lastError = null;
          break;
        } catch (fetchError) {
          lastError = fetchError instanceof Error ? fetchError : new Error("Unknown fetch error");
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
      }

      if (lastError && !isCancelled) {
        setError(lastError.message);
        setSnapshot(readCachedSnapshot());
      }

      if (!isCancelled) {
        setLoading(false);
        setRefreshing(false);
      }

      isFetchingRef.current = false;
    };

    loadSnapshot();

    const intervalId = window.setInterval(() => {
      loadSnapshot(true);
    }, refreshIntervalMs);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadSnapshot(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;
      abortController.abort();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      isFetchingRef.current = false;
      isBackgroundSyncingRef.current = false;
    };
  }, [portfolioName, refreshIntervalMs, refreshNonce, triggerAutoCertify]);

  useEffect(() => {
    let isDisposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimeoutId: number | null = null;
    const cleanupReason = "Portfolio snapshot cleanup";

    const trackedSymbols = new Set(streamSymbolsKey ? streamSymbolsKey.split("|") : []);
    const streamNames = Array.from(trackedSymbols).map((symbol) => `${symbol.toLowerCase()}@ticker`).join("/");

    if (!streamNames) {
      return () => undefined;
    }

    const streamUrl = `wss://stream.binance.com:9443/stream?streams=${streamNames}`;

    const connect = () => {
      if (isDisposed) {
        return;
      }

      const nextSocket = new WebSocket(streamUrl);
      socket = nextSocket;

      nextSocket.onopen = () => {
        if (isDisposed || socket !== nextSocket) {
          nextSocket.close(1000, cleanupReason);
        }
      };

      nextSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as BinanceTickerStreamMessage;
          const rawSymbol = message.data?.s?.toUpperCase();

          if (!rawSymbol || !trackedSymbols.has(rawSymbol)) {
            return;
          }

          const lastPriceUsd = safeNumber(message.data?.c, 0);
          const change24hPercent = safeNumber(message.data?.P, 0);
          const volume24hUsd = safeNumber(message.data?.q, 0);

          if (lastPriceUsd <= 0) {
            return;
          }

          setLastRealtimeTickAt(new Date().toISOString());
          setSnapshot((currentSnapshot) => {
            if (!currentSnapshot) {
              return currentSnapshot;
            }

            return applyRealtimeTicker(currentSnapshot, rawSymbol, lastPriceUsd, change24hPercent, volume24hUsd);
          });
        } catch {
          return;
        }
      };

      nextSocket.onclose = (event) => {
        if (socket === nextSocket) {
          socket = null;
        }

        if (isDisposed) {
          return;
        }

        if (event.code === 1000) {
          return;
        }

        reconnectTimeoutId = window.setTimeout(connect, REALTIME_RECONNECT_DELAY_MS);
      };

      nextSocket.onerror = () => {
        return;
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeoutId !== null) {
        window.clearTimeout(reconnectTimeoutId);
      }
      if (socket?.readyState === WebSocket.OPEN) {
        socket.close(1000, cleanupReason);
      }
    };
  }, [streamSymbolsKey]);

  const reload = useCallback(async () => {
    clearCachedSnapshot();
    lastAutoCertifyKeyRef.current = null;
    setRefreshNonce((value) => value + 1);
  }, [cacheKeys]);

  return {
    snapshot,
    isLoading,
    isRefreshing,
    error,
    snapshotSource,
    lastServerSyncAt,
    lastRealtimeTickAt,
    isServerSnapshotStale,
    reload
  };
}
