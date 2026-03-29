"use client";

import { useEffect, useState } from "react";

type UseBinancePriceResult = {
  priceUsd: number | null;
  isLoading: boolean;
  error: string | null;
  source: "cache" | "live" | "fallback" | "missing" | null;
};

export function useBinancePrice(symbol: string, enabled = true, fallbackPriceUsd: number | null = null): UseBinancePriceResult {
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<UseBinancePriceResult["source"]>(null);

  useEffect(() => {
    if (!enabled || !symbol) {
      setPriceUsd(null);
      setLoading(false);
      setError(null);
      setSource(null);
      return;
    }

    let isDisposed = false;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      setSource(null);

      try {
        const fallbackQuery =
          Number.isFinite(fallbackPriceUsd ?? NaN) && (fallbackPriceUsd ?? 0) > 0
            ? `&fallbackPriceUsd=${encodeURIComponent(String(fallbackPriceUsd))}`
            : "";
        const response = await fetch(`/api/binance/price?symbol=${encodeURIComponent(symbol)}${fallbackQuery}`, {
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Failed to load price (${response.status})`);
        }

        const payload = (await response.json()) as { priceUsd?: number; source?: UseBinancePriceResult["source"] };
        const nextPrice = Number(payload.priceUsd);

        if (!isDisposed) {
          if (Number.isFinite(nextPrice) && nextPrice > 0) {
            setPriceUsd(nextPrice);
            setSource(payload.source ?? null);
          } else {
            setError("Unable to load live price");
            setPriceUsd(null);
            setSource(payload.source ?? "missing");
          }
        }
      } catch (loadError) {
        if (!isDisposed) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load live price");
          setPriceUsd(null);
          setSource("missing");
        }
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [enabled, fallbackPriceUsd, symbol]);

  return { priceUsd, isLoading, error, source };
}
