"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type PortfolioSnapshot } from "@/app/lib/portfolio-types";
import {
  calculateCompositeRiskScore,
  calculateConcentrationHerfindahl,
  calculateMaxDrawdownFromSeries,
  calculateVolatilityFromSeries,
} from "@/app/lib/risk-calculator";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

type UsePortfolioSnapshotResult = {
  snapshot: PortfolioSnapshot | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const DEFAULT_REFRESH_INTERVAL_MS = 10_000;
const BACKGROUND_SYNC_COOLDOWN_MS = 30_000;
const REALTIME_RECONNECT_DELAY_MS = 2_000;
const BTC_USDT_SYMBOL = "BTCUSDT";
const PORTFOLIO_CACHE_PREFIX = "portfolio";

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

    const nextPriceUsd = round(lastPriceUsd);
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

  const allTimeProfitUsd = round(totalValueUsdRaw - totalCostBasisUsd);
  const allTimeProfitPercent = totalCostBasisUsd > 0 ? round((allTimeProfitUsd / totalCostBasisUsd) * 100) : 0;

  const sortedBy24h = [...updatedAssets].sort((a, b) => b.change24hPercent - a.change24hPercent);
  const bestPerformer = sortedBy24h[0] ?? null;
  const worstPerformer = sortedBy24h[sortedBy24h.length - 1] ?? null;

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

  if (!latestPoint) {
    chart.push({ time: nowIso, totalValueUsd });
  } else {
    const latestTime = new Date(latestPoint.time).getTime();
    const nowTime = Date.now();
    if (!Number.isFinite(latestTime) || nowTime - latestTime > 60_000) {
      chart.push({ time: nowIso, totalValueUsd });
    } else {
      chart[chart.length - 1] = { time: nowIso, totalValueUsd };
    }
  }

  const chartWindow = chart.slice(-90);
  const navSeriesUsd = chartWindow.map((point) => point.totalValueUsd);
  const concentrationIndex = calculateConcentrationHerfindahl(assetsWithAllocation.map((asset) => asset.allocationPercent));
  const maxDrawdownPercent = calculateMaxDrawdownFromSeries(navSeriesUsd);
  const volatilityPercent = calculateVolatilityFromSeries(navSeriesUsd);
  const sharpeRatio30d = currentSnapshot.metrics.sharpeRatio30d ?? null;
  const riskScore = calculateCompositeRiskScore({
    maxDrawdownPercent,
    volatilityPercent,
    concentrationIndex,
    sharpeRatio30d,
  });

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
      bestPerformer24h: bestPerformer
        ? { symbol: bestPerformer.symbol, change24hPercent: bestPerformer.change24hPercent }
        : null,
      worstPerformer24h: worstPerformer
        ? { symbol: worstPerformer.symbol, change24hPercent: worstPerformer.change24hPercent }
        : null,
      maxDrawdownPercent,
      volatilityPercent,
      concentrationIndex,
      riskScore,
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
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const isFetchingRef = useRef(false);
  const isBackgroundSyncingRef = useRef(false);
  const lastBackgroundSyncAtRef = useRef(0);
  const snapshotCacheRef = useRef<Record<string, PortfolioSnapshot>>({});

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

  const clearCachedSnapshot = () => {
    for (const key of cacheKeys) {
      delete snapshotCacheRef.current[key];
    }
  };

  const streamSymbols = useMemo(() => {
    const symbolSet = new Set((snapshot?.assets ?? []).map((asset) => asset.symbol.toUpperCase()));
    symbolSet.add(BTC_USDT_SYMBOL);
    return Array.from(symbolSet);
  }, [snapshot]);

  useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();

    const cachedSnapshot = readCachedSnapshot();
    setSnapshot(cachedSnapshot);
    setLoading(!cachedSnapshot);
    setError(null);

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
          const portfolioMode = response.headers.get("x-portfolio-mode");
          if (!isCancelled) {
            writeCachedSnapshot(data);
            setSnapshot(data);
          }

          if (portfolioMode === "binance_connected" && snapshotStale) {
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
  }, [portfolioName, refreshIntervalMs, refreshNonce]);

  useEffect(() => {
    let isDisposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimeoutId: number | null = null;

    const trackedSymbols = new Set(streamSymbols);
    const streamNames = streamSymbols.map((symbol) => `${symbol.toLowerCase()}@ticker`).join("/");

    if (!streamNames) {
      return () => undefined;
    }

    const streamUrl = `wss://stream.binance.com:9443/stream?streams=${streamNames}`;

    const connect = () => {
      if (isDisposed) {
        return;
      }

      socket = new WebSocket(streamUrl);

      socket.onmessage = (event) => {
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

      socket.onclose = () => {
        if (isDisposed) {
          return;
        }

        reconnectTimeoutId = window.setTimeout(connect, REALTIME_RECONNECT_DELAY_MS);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeoutId !== null) {
        window.clearTimeout(reconnectTimeoutId);
      }
      socket?.close();
    };
  }, [streamSymbols]);

  const reload = useCallback(async () => {
    clearCachedSnapshot();
    setRefreshNonce((value) => value + 1);
  }, [cacheKeys]);

  return { snapshot, isLoading, error, reload };
}
