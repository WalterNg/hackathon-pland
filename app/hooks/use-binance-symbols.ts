"use client";

import { useEffect, useState } from "react";

export type BinanceSymbolItem = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
};

type UseBinanceSymbolsResult = {
  symbols: BinanceSymbolItem[];
  isLoading: boolean;
  error: string | null;
};

export function useBinanceSymbols(query: string): UseBinanceSymbolsResult {
  const [symbols, setSymbols] = useState<BinanceSymbolItem[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/binance/symbols?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Failed to load symbols (${response.status})`);
        }

        const payload = (await response.json()) as { symbols?: BinanceSymbolItem[] };
        if (!isDisposed) {
          setSymbols(payload.symbols ?? []);
        }
      } catch (loadError) {
        if (!isDisposed) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load symbols");
          setSymbols([]);
        }
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [query]);

  return { symbols, isLoading, error };
}
