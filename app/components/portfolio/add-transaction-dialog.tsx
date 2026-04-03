"use client";

import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { MaterialIcon } from "../dashboard/material-icon";
import { type TransactionAction, type TransferDirection, useAddTransaction } from "@/app/hooks/use-add-transaction";
import { useBinancePrice } from "@/app/hooks/use-binance-price";
import { formatLocaleNumber, formatLocaleNumberInput, parseLocaleNumber, removeNumberGrouping } from "@/app/lib/number-format";

type SelectedCoin = {
  symbol: string;
  name: string | null;
  baseAsset: string;
  quoteAsset: string;
};

type AddTransactionDialogProps = {
  open: boolean;
  onClose: () => void;
  portfolioName: string;
  coin: SelectedCoin | null;
  portfolioAssets: Array<{ symbol: string; priceUsd: number }>;
  initialAction?: TransactionAction;
  initialNote?: string;
  onChangeCoin: () => void;
  onCreated: () => void;
};

const actionTabs: Array<{ label: string; value: TransactionAction }> = [
  { label: "Buy", value: "buy" },
  { label: "Sell", value: "sell" },
  { label: "Transfer", value: "transfer" }
];

type EditorKind = "executedAt" | "fee" | "note" | null;

const hourOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const meridiemOptions = ["AM", "PM"] as const;

function nowLocalDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function toExecutionTimeParts(date: Date) {
  const hour24 = date.getHours();
  const hour12 = hour24 % 12 || 12;

  return {
    hour: String(hour12).padStart(2, "0"),
    minute: String(date.getMinutes()).padStart(2, "0"),
    meridiem: hour24 >= 12 ? ("PM" as const) : ("AM" as const)
  };
}

function composeExecutedAt(dateValue: string, hour: string, minute: string, meridiem: (typeof meridiemOptions)[number]) {
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);

  if (!dateValue || !Number.isFinite(hourNumber) || !Number.isFinite(minuteNumber)) {
    return "";
  }

  const normalizedHour = hourNumber % 12 + (meridiem === "PM" ? 12 : 0);
  return `${dateValue}T${String(normalizedHour).padStart(2, "0")}:${String(minuteNumber).padStart(2, "0")}:00`;
}

function formatExecutedAtPreview(dateValue: string, hour: string, minute: string, meridiem: (typeof meridiemOptions)[number]) {
  const composed = composeExecutedAt(dateValue, hour, minute, meridiem);

  if (!composed) {
    return "";
  }

  const date = new Date(composed);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function symbolDisplay(symbol: string, quoteAsset: string) {
  return symbol.endsWith(quoteAsset) ? symbol.slice(0, symbol.length - quoteAsset.length) : symbol;
}

function handleNumberInputFocus(setValue: (nextValue: string) => void) {
  return (event: FocusEvent<HTMLInputElement>) => {
    setValue(removeNumberGrouping(event.target.value));
  };
}

function sanitizeNumericInput(value: string) {
  return value.replace(/[^0-9.,]/g, "");
}

export function AddTransactionDialog({
  open,
  onClose,
  portfolioName,
  coin,
  portfolioAssets,
  initialAction = "buy",
  initialNote = "",
  onChangeCoin,
  onCreated
}: AddTransactionDialogProps) {
  const [action, setAction] = useState<TransactionAction>("buy");
  const [transferDirection, setTransferDirection] = useState<TransferDirection>("in");
  const [quantity, setQuantity] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [feeUsd, setFeeUsd] = useState("");
  const [note, setNote] = useState("");
  const [executionDate, setExecutionDate] = useState(() => nowLocalDateValue());
  const [executionHour, setExecutionHour] = useState(() => toExecutionTimeParts(new Date()).hour);
  const [executionMinute, setExecutionMinute] = useState(() => toExecutionTimeParts(new Date()).minute);
  const [executionMeridiem, setExecutionMeridiem] = useState<(typeof meridiemOptions)[number]>(() => toExecutionTimeParts(new Date()).meridiem);
  const [activeEditor, setActiveEditor] = useState<EditorKind>(null);
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
    setAction(initialAction);
    setTransferDirection("in");
    setQuantity("");
    setPriceUsd(formatLocaleNumber(selectedAssetPrice ?? 0));
    setFeeUsd("");
    setNote(initialNote);
    const now = new Date();
    const timeParts = toExecutionTimeParts(now);
    setExecutionDate(nowLocalDateValue());
    setExecutionHour(timeParts.hour);
    setExecutionMinute(timeParts.minute);
    setExecutionMeridiem(timeParts.meridiem);
    setActiveEditor(null);
  }, [open, coin?.symbol, initialAction, initialNote]);

  useEffect(() => {
    if (!open || !coin || action === "transfer" || priceTouchedRef.current) {
      return;
    }

    if (!livePriceUsd) {
      return;
    }

    setPriceUsd(formatLocaleNumber(livePriceUsd));
  }, [action, coin?.symbol, livePriceUsd, open]);

  const quantityNumber = parseLocaleNumber(quantity) || 0;
  const priceNumber = parseLocaleNumber(priceUsd) || 0;
  const totalSpent = useMemo(() => {
    if (action === "transfer") {
      return 0;
    }

    return quantityNumber * priceNumber;
  }, [action, priceNumber, quantityNumber]);

  const executedAtPreview = useMemo(
    () => formatExecutedAtPreview(executionDate, executionHour, executionMinute, executionMeridiem),
    [executionDate, executionHour, executionMinute, executionMeridiem]
  );
  if (!open || !coin) {
    return null;
  }

  const canSubmit = quantityNumber > 0 && (action === "transfer" || priceNumber > 0);
  const shortSymbol = symbolDisplay(coin.symbol, coin.quoteAsset);
  const submit = async () => {
    if (!canSubmit) {
      return;
    }

    const executedAtValue = composeExecutedAt(executionDate, executionHour, executionMinute, executionMeridiem);
    if (!executedAtValue) {
      return;
    }

    const ok = await submitTransaction({
      portfolioName,
      symbol: coin.symbol,
      action,
      transferDirection,
      quantity: quantityNumber,
      priceUsd: action === "transfer" ? 0 : priceNumber,
      feeUsd: parseLocaleNumber(feeUsd) || 0,
      note: note.trim() || undefined,
      executedAt: new Date(executedAtValue).toISOString()
    });

    if (ok) {
      onCreated();
      onClose();
    }
  };

  return (
    <div className="modal-backdrop z-90">
      <div className="modal-shell max-w-lg p-4 sm:p-4">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="mt-2 text-lg font-bold text-strong sm:text-xl">Add Transaction</h2>
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
              <span className="text-lg font-semibold text-strong">{shortSymbol}</span>
              <span className="text-sm font-semibold text-muted">{coin.name || coin.baseAsset}</span>
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
              type="text"
              min="0"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              onBlur={() => setQuantity((current) => formatLocaleNumberInput(current, { maximumFractionDigits: 12 }))}
              onFocus={handleNumberInputFocus(setQuantity)}
              className="field-input"
            />
          </div>

          {action !== "transfer" ? (
            <div>
              <label className="field-label">Price Per Coin</label>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 select-none text-[0.95rem] leading-none font-semibold text-muted"
                >
                  $
                </span>
                <input
                  type="text"
                  min="0"
                  inputMode="decimal"
                  value={priceUsd}
                  onChange={(event) => {
                    priceTouchedRef.current = true;
                    setPriceUsd(sanitizeNumericInput(event.target.value));
                  }}
                  onBlur={() => setPriceUsd((current) => formatLocaleNumberInput(current))}
                  className="field-input !pl-8"
                  placeholder={isLivePriceLoading ? "Loading live price..." : "Auto-filled with current price"}
                />
              </div>
            </div>
          ) : (
            <div className="field-static items-end">
              Price is not required for transfer
            </div>
          )}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveEditor("executedAt")}
            className="flex min-h-[3rem] items-center gap-2.5 rounded-xl bg-(--surface-container-highest) px-3 py-2.5 text-left transition-colors duration-200 ease-out hover:bg-(--surface-bright)"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--surface-bright) text-muted">
              <MaterialIcon name="calendar_month" outlined={false} className="text-sm" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold text-muted">Executed At</span>
              <span className="block truncate text-[12px] font-semibold text-strong">{executedAtPreview || "Choose date and time"}</span>
            </span>
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setActiveEditor("fee")}
              className="flex min-h-[3rem] items-center gap-2.5 rounded-xl bg-(--surface-container-highest) px-3 py-2.5 text-left transition-colors duration-200 ease-out hover:bg-(--surface-bright)"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--surface-bright) text-muted">
                <MaterialIcon name="payments" outlined={false} className="text-sm" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-strong">Fee</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveEditor("note")}
              className="flex min-h-[3rem] items-center gap-2.5 rounded-xl bg-(--surface-container-highest) px-3 py-2.5 text-left transition-colors duration-200 ease-out hover:bg-(--surface-bright)"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--surface-bright) text-muted">
                <MaterialIcon name="edit_note" outlined={false} className="text-sm" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-strong">Notes</span>
              </span>
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-(--surface-container-low) p-3.5 sm:p-4">
          <div className="mb-1 text-[11px] font-medium text-muted">Total Spent</div>
          <div className="text-[2rem] font-bold tracking-tight text-strong sm:text-[2.3rem]">
            {coin.quoteAsset} {formatLocaleNumber(totalSpent, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
          </div>
        </div>

        {error && <div className="panel-low mb-3 p-3 text-xs text-danger sm:text-sm">{error}</div>}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || isSubmitting}
          className="ui-button-primary mt-2 w-full text-base disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Add Transaction"}
        </button>
      </div>

      {activeEditor && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(3,5,10,0.72)] p-4"
          onClick={() => setActiveEditor(null)}
        >
          <div className="modal-shell w-full max-w-md p-5 sm:p-6" onClick={(event) => event.stopPropagation()}>
            {activeEditor === "executedAt" ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setActiveEditor(null)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-(--surface-bright) text-muted transition-colors duration-200 hover:text-strong"
                    aria-label="Back"
                  >
                    <MaterialIcon name="arrow_back" outlined={false} className="text-lg" />
                  </button>
                  <h3 className="flex-1 text-left text-xl font-bold text-strong">Executed At</h3>
                </div>

                <div className="grid gap-3">
                  <div>
                    <label className="field-label">Date</label>
                    <input
                      type="date"
                      value={executionDate}
                      onChange={(event) => setExecutionDate(event.target.value)}
                      className="field-input"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="field-label">Hour</label>
                      <select
                        value={executionHour}
                        onChange={(event) => setExecutionHour(event.target.value)}
                        className="field-select"
                        aria-label="Hour"
                      >
                        {hourOptions.map((hour) => (
                          <option key={hour} value={hour}>
                            {hour}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Minute</label>
                      <select
                        value={executionMinute}
                        onChange={(event) => setExecutionMinute(event.target.value)}
                        className="field-select"
                        aria-label="Minute"
                      >
                        {minuteOptions.map((minute) => (
                          <option key={minute} value={minute}>
                            {minute}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">AM/PM</label>
                      <select
                        value={executionMeridiem}
                        onChange={(event) => setExecutionMeridiem(event.target.value as (typeof meridiemOptions)[number])}
                        className="field-select"
                        aria-label="AM or PM"
                      >
                        {meridiemOptions.map((part) => (
                          <option key={part} value={part}>
                            {part}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl bg-(--surface-container-highest) px-3 py-2 text-sm font-semibold text-strong">
                    {executedAtPreview}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveEditor(null)}
                  className="ui-button-primary mt-4 w-full text-base"
                >
                  Set Date & Time
                </button>
              </>
            ) : activeEditor === "fee" ? (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveEditor(null)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-(--surface-bright) text-muted transition-colors duration-200 hover:text-strong"
                    aria-label="Back"
                  >
                    <MaterialIcon name="arrow_back" outlined={false} className="text-lg" />
                  </button>
                  <h3 className="text-xl font-bold text-strong">Add Fee</h3>
                </div>

                <div className="grid gap-3">
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-[0.95rem] leading-none font-semibold text-muted"
                    >
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={feeUsd}
                      onChange={(event) => setFeeUsd(sanitizeNumericInput(event.target.value))}
                      onBlur={() => setFeeUsd((current) => formatLocaleNumberInput(current))}
                      onFocus={handleNumberInputFocus(setFeeUsd)}
                      placeholder="0.00"
                      className="field-input !pl-8"
                    />
                  </div>

                  <p className="text-sm leading-6 text-muted">
                    The transaction fee entered will be included as part of the Profit/Loss calculation.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveEditor(null)}
                  className="ui-button-primary mt-4 w-full text-base"
                >
                  Add Fee
                </button>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveEditor(null)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-(--surface-bright) text-muted transition-colors duration-200 hover:text-strong"
                    aria-label="Back"
                  >
                    <MaterialIcon name="arrow_back" outlined={false} className="text-lg" />
                  </button>
                  <h3 className="text-xl font-bold text-strong">Add Note</h3>
                </div>

                <div className="grid gap-3">
                  <div className="relative">
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value.slice(0, 200))}
                      placeholder="Write your note here..."
                      maxLength={200}
                      className="field-textarea min-h-32 resize-none pb-10 pr-16"
                    />
                    <div className="pointer-events-none absolute right-4 bottom-3 text-sm font-semibold text-strong">
                      {note.length}/200
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveEditor(null)}
                  className="ui-button-primary mt-4 w-full text-base"
                >
                  Add Note
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
