"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MaterialIcon } from "../dashboard/material-icon";
import { type TransactionAction, type TransferDirection, useAddTransaction } from "@/app/hooks/use-add-transaction";
import { useBinancePrice } from "@/app/hooks/use-binance-price";

type SelectedCoin = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
};

type AddTransactionDialogProps = {
  open: boolean;
  onClose: () => void;
  portfolioName: string;
  coin: SelectedCoin | null;
  portfolioAssets: Array<{ symbol: string; priceUsd: number }>;
  onChangeCoin: () => void;
  onCreated: () => void;
};

const actionTabs: Array<{ label: string; value: TransactionAction }> = [
  { label: "Buy", value: "buy" },
  { label: "Sell", value: "sell" },
  { label: "Transfer", value: "transfer" }
];

function nowLocalDateTimeValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function symbolDisplay(symbol: string, quoteAsset: string) {
  return symbol.endsWith(quoteAsset) ? symbol.slice(0, symbol.length - quoteAsset.length) : symbol;
}

function formatPriceInputValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  return value.toFixed(8).replace(/\.?0+$/, "");
}

export function AddTransactionDialog({
  open,
  onClose,
  portfolioName,
  coin,
  portfolioAssets,
  onChangeCoin,
  onCreated
}: AddTransactionDialogProps) {
  const [action, setAction] = useState<TransactionAction>("buy");
  const [transferDirection, setTransferDirection] = useState<TransferDirection>("in");
  const [quantity, setQuantity] = useState("0");
  const [priceUsd, setPriceUsd] = useState("");
  const [feeUsd, setFeeUsd] = useState("0");
  const [note, setNote] = useState("");
  const [dateTime, setDateTime] = useState(nowLocalDateTimeValue());
  const priceTouchedRef = useRef(false);
  const selectedAssetPrice = portfolioAssets.find((asset) => asset.symbol === coin?.symbol)?.priceUsd ?? null;
  const { isSubmitting, error, submitTransaction } = useAddTransaction();
  const { priceUsd: livePriceUsd, isLoading: isLivePriceLoading, error: livePriceError, source: livePriceSource } = useBinancePrice(
    coin?.symbol ?? "",
    open && !!coin && action !== "transfer",
    selectedAssetPrice
  );

  useEffect(() => {
    if (!open || !coin) {
      return;
    }

    priceTouchedRef.current = false;
    setAction("buy");
    setTransferDirection("in");
    setQuantity("0");
    setPriceUsd(formatPriceInputValue(selectedAssetPrice ?? 0));
    setFeeUsd("0");
    setNote("");
    setDateTime(nowLocalDateTimeValue());
  }, [open, coin?.symbol]);

  useEffect(() => {
    if (!open || !coin || action === "transfer" || priceTouchedRef.current) {
      return;
    }

    if (!livePriceUsd) {
      return;
    }

    setPriceUsd(formatPriceInputValue(livePriceUsd));
  }, [action, coin?.symbol, livePriceUsd, open]);

  const quantityNumber = Number(quantity) || 0;
  const priceNumber = Number(priceUsd) || 0;
  const totalSpent = useMemo(() => {
    if (action === "transfer") {
      return 0;
    }

    return quantityNumber * priceNumber;
  }, [action, priceNumber, quantityNumber]);

  if (!open || !coin) {
    return null;
  }

  const canSubmit = quantityNumber > 0 && (action === "transfer" || priceNumber > 0);
  const shortSymbol = symbolDisplay(coin.symbol, coin.quoteAsset);

  const submit = async () => {
    if (!canSubmit) {
      return;
    }

    const ok = await submitTransaction({
      portfolioName,
      symbol: coin.symbol,
      action,
      transferDirection,
      quantity: quantityNumber,
      priceUsd: action === "transfer" ? 0 : priceNumber,
      feeUsd: Number(feeUsd) || 0,
      note: note.trim() || undefined,
      executedAt: new Date(dateTime).toISOString()
    });

    if (ok) {
      onCreated();
      onClose();
    }
  };

  return (
    <div className="modal-backdrop z-[90]">
      <div className="modal-shell max-w-lg p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-strong">Add Transaction</h2>
          <button type="button" onClick={onClose} className="icon-button h-10 w-10" aria-label="Close add transaction">
            <MaterialIcon name="close" outlined={false} className="text-xl" />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-3 rounded-xl bg-(--surface-container-highest) p-1">
          {actionTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setAction(tab.value)}
              className={
                action === tab.value
                  ? "rounded-lg bg-(--surface-bright) py-2 text-xs font-semibold text-strong sm:text-sm"
                  : "py-2 text-xs font-semibold text-muted sm:text-sm"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onChangeCoin}
          className="mb-5 flex w-full items-center justify-between rounded-xl bg-(--surface-container-highest) px-3.5 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-(--surface-bright) text-xs font-bold text-warning">
              {shortSymbol.slice(0, 1)}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-strong">{coin.baseAsset}</span>
              <span className="text-sm font-semibold text-muted">{shortSymbol}</span>
            </div>
          </div>
          <MaterialIcon name="expand_more" outlined={false} className="text-muted" />
        </button>

        {action === "transfer" && (
          <div className="mb-4">
            <label className="field-label">Transfer</label>
            <div className="relative">
              <select
                value={transferDirection}
                onChange={(event) => setTransferDirection(event.target.value as TransferDirection)}
                className="field-select appearance-none pr-12"
              >
                <option value="in">Transfer In</option>
                <option value="out">Transfer Out</option>
              </select>
              <MaterialIcon name="expand_more" outlined={false} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
            </div>
          </div>
        )}

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="field-label">Quantity</label>
            <input
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="field-input"
            />
          </div>

          {action !== "transfer" ? (
            <div>
              <label className="field-label">Price Per Coin</label>
              <input
                type="number"
                min="0"
                step="any"
                value={priceUsd}
                onChange={(event) => {
                  priceTouchedRef.current = true;
                  setPriceUsd(event.target.value);
                }}
                className="field-input"
                placeholder={isLivePriceLoading ? "Loading live price..." : "Auto-filled with current price"}
              />
            </div>
          ) : (
            <div className="field-static items-end">
              Price is not required for transfer
            </div>
          )}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="field-label">Executed At</label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(event) => setDateTime(event.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">Fee</label>
            <input
              type="number"
              min="0"
              step="any"
              value={feeUsd}
              onChange={(event) => setFeeUsd(event.target.value)}
              placeholder="Optional"
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">Note</label>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional"
              className="field-input"
            />
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-(--surface-container-low) p-3.5 sm:p-4">
          <div className="mb-1.5 text-xs font-medium text-muted sm:text-sm">Total Spent</div>
          <div className="text-3xl font-bold tracking-tight text-strong sm:text-4xl">
            {coin.quoteAsset} {totalSpent.toFixed(4)}
          </div>
        </div>

        {error && <div className="panel-low mb-3 p-3 text-xs text-danger sm:text-sm">{error}</div>}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || isSubmitting}
          className="ui-button-primary w-full text-base disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Add Transaction"}
        </button>
      </div>
    </div>
  );
}
