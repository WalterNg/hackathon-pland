"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PortfolioForecast, PortfolioForecastResponse, PortfolioSnapshot } from "@/app/lib/portfolio-types";

type UsePortfolioForecastResult = {
  forecast: PortfolioForecast | null;
  isLoading: boolean;
  error: string | null;
  ensureLoaded: () => void;
  refresh: () => void;
};

type ForecastRequestPayload = {
  user_id: string;
  portfolio: Array<{
    asset: string;
    amount: number;
    current_price: number;
  }>;
  stablecoin_reserve: number;
};

type CachedForecastEntry = {
  expiresAt: number;
  forecast: PortfolioForecast;
};

const FORECAST_CACHE_TTL_MS = 5 * 60 * 1000;
const forecastCache = new Map<string, CachedForecastEntry>();

function readForecastCache(cacheKey: string | null): PortfolioForecast | null {
  if (!cacheKey) {
    return null;
  }

  const cached = forecastCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() >= cached.expiresAt) {
    forecastCache.delete(cacheKey);
    return null;
  }

  return cached.forecast;
}

function writeForecastCache(cacheKey: string, forecast: PortfolioForecast): void {
  forecastCache.set(cacheKey, {
    forecast,
    expiresAt: Date.now() + FORECAST_CACHE_TTL_MS,
  });
}

export function usePortfolioForecast(snapshot: PortfolioSnapshot | null): UsePortfolioForecastResult {
  const [forecast, setForecast] = useState<PortfolioForecast | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const lastCompositionSignatureRef = useRef<string | null>(null);

  const requestPayload = useMemo<ForecastRequestPayload | null>(() => {
    const portfolio = snapshot?.assets ?? [];
    if (!snapshot || portfolio.length === 0) {
      return null;
    }

    return {
      user_id: snapshot.summary.name,
      portfolio: portfolio.map((asset) => ({
        asset: asset.symbol,
        amount: Number(asset.quantity.toFixed(8)),
        current_price: Number(asset.priceUsd.toFixed(8)),
      })),
      stablecoin_reserve: 0,
    };
  }, [snapshot]);

  const cacheKey = useMemo(() => {
    if (!requestPayload) {
      return null;
    }

    return JSON.stringify({
      portfolioName: requestPayload.user_id,
      stablecoinReserve: requestPayload.stablecoin_reserve,
      horizonHours: 48,
      stepHours: 1,
      positions: [...requestPayload.portfolio]
        .sort((left, right) => left.asset.localeCompare(right.asset))
        .map((asset) => ({
          asset: asset.asset,
          amount: asset.amount,
          currentPrice: asset.current_price,
        })),
    });
  }, [requestPayload]);

  const compositionSignature = useMemo(() => {
    if (!requestPayload) {
      return null;
    }

    return JSON.stringify({
      portfolioName: requestPayload.user_id,
      positions: [...requestPayload.portfolio]
        .sort((left, right) => left.asset.localeCompare(right.asset))
        .map((asset) => ({
          asset: asset.asset,
          amount: asset.amount,
        })),
    });
  }, [requestPayload]);

  useEffect(() => {
    if (!requestPayload || !compositionSignature) {
      lastCompositionSignatureRef.current = null;
      setForecast(null);
      setError(null);
      setLoading(false);
      return;
    }

    const compositionChanged = lastCompositionSignatureRef.current !== compositionSignature;
    lastCompositionSignatureRef.current = compositionSignature;

    const cachedForecast = readForecastCache(cacheKey);
    if (cachedForecast) {
      setForecast(cachedForecast);
      setError(null);
      setLoading(false);
      return;
    }

    if (compositionChanged) {
      setForecast(null);
      setError(null);
      setLoading(false);
    }
  }, [cacheKey, compositionSignature, requestPayload]);

  const loadForecast = useCallback(
    async (forceRefresh: boolean) => {
      if (!requestPayload || !cacheKey) {
        setForecast(null);
        setError(null);
        setLoading(false);
        return;
      }

      if (!forceRefresh) {
        const cachedForecast = readForecastCache(cacheKey);
        if (cachedForecast) {
          setForecast(cachedForecast);
          setError(null);
          setLoading(false);
          return;
        }
      }

      requestIdRef.current += 1;
      const currentRequestId = requestIdRef.current;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/portfolio/forecast", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
        });

        const payload = (await response.json().catch(() => null)) as PortfolioForecastResponse | null;
        if (requestIdRef.current !== currentRequestId) {
          return;
        }

        if (!response.ok || payload?.status !== "success" || !payload.data) {
          setError(payload?.message || "Forecast unavailable.");
          setLoading(false);
          return;
        }

        writeForecastCache(cacheKey, payload.data);
        setForecast(payload.data);
        setError(null);
        setLoading(false);
      } catch (err) {
        if (requestIdRef.current !== currentRequestId) {
          return;
        }

        setError(err instanceof Error ? err.message : "Forecast unavailable.");
        setLoading(false);
      }
    },
    [cacheKey, requestPayload],
  );

  return {
    forecast,
    isLoading,
    error,
    ensureLoaded: () => {
      void loadForecast(false);
    },
    refresh: () => {
      if (cacheKey) {
        forecastCache.delete(cacheKey);
      }
      void loadForecast(true);
    },
  };
}
