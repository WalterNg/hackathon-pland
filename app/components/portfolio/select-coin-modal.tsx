"use client";

import { useMemo, useState } from "react";
import { MaterialIcon } from "../dashboard/material-icon";
import { useBinanceSymbols } from "@/app/hooks/use-binance-symbols";

type SelectCoinModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (coin: { symbol: string; name: string | null; baseAsset: string; quoteAsset: string }) => void;
};

function symbolDisplay(symbol: string, quoteAsset: string) {
  return symbol.endsWith(quoteAsset) ? symbol.slice(0, symbol.length - quoteAsset.length) : symbol;
}

export function SelectCoinModal({ open, onClose, onSelect }: SelectCoinModalProps) {
  const [search, setSearch] = useState("");
  const { symbols, isLoading } = useBinanceSymbols(search, open);

  const visibleItems = useMemo(() => symbols.slice(0, 40), [symbols]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop z-80">
      <div className="modal-shell max-w-lg p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-strong">Select Coin</h2>
          <button type="button" onClick={onClose} className="icon-button h-10 w-10" aria-label="Close coin picker">
            <MaterialIcon name="close" outlined={false} className="text-xl" />
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          className="field-input mb-4"
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
                onClick={() => onSelect({ symbol: coin.symbol, name: coin.name, baseAsset: coin.baseAsset, quoteAsset: coin.quoteAsset })}
                className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-(--surface-container-low)"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--surface-container-highest) text-xs font-bold text-warning">
                    {shortSymbol.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-strong">{shortSymbol}</div>
                    <div className="text-xs font-semibold text-muted sm:text-sm">{coin.name || coin.baseAsset}</div>
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
