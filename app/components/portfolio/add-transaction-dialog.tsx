"use client";

import { useMemo, useState } from "react";
import { MaterialIcon } from "../dashboard/material-icon";
import { type TransactionAction, type TransferDirection, useAddTransaction } from "@/app/hooks/use-add-transaction";

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

export function AddTransactionDialog({
  open,
  onClose,
  portfolioName,
  coin,
  onChangeCoin,
  onCreated
}: AddTransactionDialogProps) {
  const [action, setAction] = useState<TransactionAction>("buy");
  const [transferDirection, setTransferDirection] = useState<TransferDirection>("in");
  const [quantity, setQuantity] = useState("0");
  const [priceUsd, setPriceUsd] = useState("0");
  const [feeUsd, setFeeUsd] = useState("0");
  const [note, setNote] = useState("");
  const [dateTime, setDateTime] = useState(nowLocalDateTimeValue());
  const { isSubmitting, error, submitTransaction } = useAddTransaction();

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
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-soft">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-4xl font-bold text-strong">Add Transaction</h2>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-body" aria-label="Close add transaction">
            <MaterialIcon name="close" outlined={false} className="text-2xl" />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-3 rounded-xl border border-gray-200 bg-gray-100 p-1">
          {actionTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setAction(tab.value)}
              className={
                action === tab.value
                  ? "rounded-lg bg-white py-2 text-sm font-semibold text-strong"
                  : "py-2 text-sm font-semibold text-muted"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onChangeCoin}
          className="mb-5 flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-100 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-500">
              {shortSymbol.slice(0, 1)}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-strong">{coin.baseAsset}</span>
              <span className="text-lg font-semibold text-muted">{shortSymbol}</span>
            </div>
          </div>
          <MaterialIcon name="expand_more" outlined={false} className="text-muted" />
        </button>

        {action === "transfer" && (
          <div className="mb-5">
            <label className="mb-2 block text-xl font-semibold text-body">Transfer</label>
            <div className="relative">
              <select
                value={transferDirection}
                onChange={(event) => setTransferDirection(event.target.value as TransferDirection)}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-xl font-semibold text-strong outline-none"
              >
                <option value="in">Transfer In</option>
                <option value="out">Transfer Out</option>
              </select>
              <MaterialIcon name="expand_more" outlined={false} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
            </div>
          </div>
        )}

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xl font-semibold text-body">Quantity</label>
            <input
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-xl font-semibold text-strong outline-none ring-primary focus:ring-2"
            />
          </div>

          {action !== "transfer" ? (
            <div>
              <label className="mb-2 block text-xl font-semibold text-body">Price Per Coin</label>
              <input
                type="number"
                min="0"
                step="any"
                value={priceUsd}
                onChange={(event) => setPriceUsd(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-xl font-semibold text-strong outline-none ring-primary focus:ring-2"
              />
            </div>
          ) : (
            <div className="flex items-end rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-xl font-semibold text-muted">
              Price is not required for transfer
            </div>
          )}
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(event) => setDateTime(event.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-semibold text-body outline-none ring-primary focus:ring-2"
          />
          <input
            type="number"
            min="0"
            step="any"
            value={feeUsd}
            onChange={(event) => setFeeUsd(event.target.value)}
            placeholder="Fee"
            className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-semibold text-body outline-none ring-primary focus:ring-2"
          />
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Notes"
            className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-semibold text-body outline-none ring-primary focus:ring-2"
          />
        </div>

        <div className="mb-5 rounded-xl border border-gray-200 bg-gray-100 p-4">
          <div className="text-2xl text-muted">Total Spent</div>
          <div className="text-5xl font-bold text-strong">
            {coin.quoteAsset} {totalSpent.toFixed(4)}
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 text-sm text-danger">{error}</div>}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || isSubmitting}
          className="text-on-primary w-full rounded-xl bg-primary px-5 py-3 text-2xl font-semibold transition hover:bg-primary-hover disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Add Transaction"}
        </button>
      </div>
    </div>
  );
}
