"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { PortfolioForecast, PortfolioForecastResponse, PortfolioSnapshot } from "@/app/lib/portfolio-types";

type UsePortfolioForecastResult = {
  forecast: PortfolioForecast | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
};

export function usePortfolioForecast(snapshot: PortfolioSnapshot | null): UsePortfolioForecastResult {
  const [forecast, setForecast] = useState<PortfolioForecast | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const requestPayload = useMemo(() => {
    const portfolio = snapshot?.assets ?? [];
    if (!snapshot || portfolio.length === 0) {
      return null;
    }

    return {
      user_id: snapshot.summary.name,
      portfolio: portfolio.map((asset) => ({
        asset: asset.symbol,
        amount: Number(asset.quantity.toFixed(8)),
        current_price: Number(asset.priceUsd.toFixed(2)),
      })),
      stablecoin_reserve: 0,
    };
  }, [snapshot]);

  const compositionSignature = useMemo(() => {
    const portfolio = snapshot?.assets ?? [];
    if (!snapshot || portfolio.length === 0) {
      return null;
    }

    return JSON.stringify({
      portfolioName: snapshot.summary.name,
      positions: portfolio
        .map((asset) => ({
          asset: asset.symbol,
          amount: Number(asset.quantity.toFixed(8)),
        }))
        .sort((left, right) => left.asset.localeCompare(right.asset)),
    });
  }, [snapshot?.summary.name, snapshot?.assets]);

  useEffect(() => {
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;
    const controller = new AbortController();
    let timeoutId: number | null = null;

    if (!requestPayload || !compositionSignature) {
      setForecast(null);
      setLoading(false);
      setError(null);
      hasLoadedRef.current = false;
      return () => controller.abort();
    }

    if (!hasLoadedRef.current) {
      setLoading(true);
    }

    const loadForecast = async () => {
      try {
        setError(null);
        const response = await fetch("/api/portfolio/forecast", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
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

        setForecast(payload.data);
        hasLoadedRef.current = true;
        setError(null);
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted || requestIdRef.current !== currentRequestId) {
          return;
        }

        setError(err instanceof Error ? err.message : "Forecast unavailable.");
        setLoading(false);
      }
    };

    timeoutId = window.setTimeout(() => {
      void loadForecast();
    }, hasLoadedRef.current ? 1200 : 0);

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      controller.abort();
    };
  }, [compositionSignature, refreshToken]);

  return {
    forecast,
    isLoading,
    error,
    refresh: () => setRefreshToken((value) => value + 1),
  };
}
