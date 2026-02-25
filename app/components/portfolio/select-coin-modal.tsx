"use client";

import { useMemo, useState } from "react";
import { MaterialIcon } from "../dashboard/material-icon";
import { useBinanceSymbols } from "@/app/hooks/use-binance-symbols";

type SelectCoinModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (coin: { symbol: string; baseAsset: string; quoteAsset: string }) => void;
};

function symbolDisplay(symbol: string, quoteAsset: string) {
  return symbol.endsWith(quoteAsset) ? symbol.slice(0, symbol.length - quoteAsset.length) : symbol;
}

export function SelectCoinModal({ open, onClose, onSelect }: SelectCoinModalProps) {
  const [search, setSearch] = useState("");
  const { symbols, isLoading } = useBinanceSymbols(search);

  const visibleItems = useMemo(() => symbols.slice(0, 40), [symbols]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-soft">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-4xl font-bold text-strong">Select Coin</h2>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-body" aria-label="Close coin picker">
            <MaterialIcon name="close" outlined={false} className="text-2xl" />
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          className="mb-5 w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-body outline-none ring-primary focus:ring-2"
        />

        <div className="max-h-120 space-y-1 overflow-y-auto">
          {isLoading && <div className="px-3 py-2 text-sm text-muted">Loading coins…</div>}

          {!isLoading && visibleItems.length === 0 && <div className="px-3 py-2 text-sm text-muted">No coin found.</div>}

          {visibleItems.map((coin) => {
            const shortSymbol = symbolDisplay(coin.symbol, coin.quoteAsset);

            return (
              <button
                key={coin.symbol}
                type="button"
                onClick={() => onSelect({ symbol: coin.symbol, baseAsset: coin.baseAsset, quoteAsset: coin.quoteAsset })}
                className="group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-500">
                    {shortSymbol.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-strong">{coin.baseAsset}</div>
                    <div className="text-sm font-semibold text-muted">{shortSymbol}</div>
                  </div>
                </div>

                <MaterialIcon name="chevron_right" outlined={false} className="text-muted transition group-hover:text-body" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
