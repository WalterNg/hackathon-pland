"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialIcon } from "../dashboard/material-icon";
import { getFullCoinName } from "@/app/lib/coin-names";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

// ── Types ─────────────────────────────────────────────────────────────────────

type TxSide = "buy" | "sell" | "deposit" | "withdrawal" | "airdrop" | "fee";

type TransactionRow = {
  id: string;
  portfolio_id: string;
  symbol: string;
  side: TxSide;
  quantity: number;
  price_usd: number;
  fee_usd: number;
  note: string | null;
  executed_at: string;
  portfolios: Array<{ name: string }> | null;
};

type EditDraft = {
  quantity: string;
  priceUsd: string;
  feeUsd: string;
  note: string;
  executedAt: string; // local datetime-local value
};

// ── Formatters ────────────────────────────────────────────────────────────────

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

function fmtUsd(v: number) { return Number.isFinite(v) && v > 0 ? usdFmt.format(v) : "--"; }
function fmtQty(v: number, symbol: string) {
  const dp = v < 0.001 ? 8 : v < 1 ? 6 : v < 1000 ? 4 : 2;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: dp })} ${toDisplaySymbol(symbol)}`;
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDisplaySymbol(symbol: string): string {
  const n = symbol.trim().toUpperCase();
  if (n.endsWith("USDT") && n.length > 4) return n.slice(0, -4);
  if (n.endsWith("BUSD") && n.length > 4) return n.slice(0, -4);
  return n;
}

const SIDE_META: Record<TxSide, { label: string; color: string; icon: string }> = {
  buy:        { label: "Buy",        color: "text-[#0ecb81] bg-[#0ecb81]/10", icon: "trending_up" },
  sell:       { label: "Sell",       color: "text-[#f6465d] bg-[#f6465d]/10", icon: "trending_down" },
  deposit:    { label: "Transfer In",  color: "text-[var(--text-info)] bg-[var(--text-info)]/10",   icon: "arrow_downward" },
  withdrawal: { label: "Transfer Out", color: "text-[var(--text-warning)] bg-[var(--text-warning)]/10", icon: "arrow_upward" },
  airdrop:    { label: "Airdrop",    color: "text-[var(--text-accent)] bg-[var(--text-accent)]/10", icon: "redeem" },
  fee:        { label: "Fee",        color: "text-muted bg-white/5",          icon: "receipt" },
};

const ALL_TYPES: TxSide[] = ["buy", "sell", "deposit", "withdrawal", "airdrop", "fee"];

// ── Edit modal ─────────────────────────────────────────────────────────────────

function EditModal({
  tx,
  portfolioName,
  onSave,
  onClose,
}: {
  tx: TransactionRow;
  portfolioName: string;
  onSave: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EditDraft>({
    quantity:    String(tx.quantity),
    priceUsd:   String(tx.price_usd),
    feeUsd:     String(tx.fee_usd ?? 0),
    note:       tx.note ?? "",
    executedAt: toLocalDatetimeValue(tx.executed_at),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const quantity = Number(draft.quantity);
    const priceUsd = Number(draft.priceUsd);
    const feeUsd   = Number(draft.feeUsd);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }
    if (tx.side !== "deposit" && tx.side !== "withdrawal" && tx.side !== "fee") {
      if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
        setError("Price must be a positive number.");
        return;
      }
    }
    const executedAt = draft.executedAt ? new Date(draft.executedAt).toISOString() : tx.executed_at;

    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithSupabaseAuth(
        `/api/portfolio/transactions/${tx.id}?portfolioName=${encodeURIComponent(portfolioName)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity, priceUsd, feeUsd, note: draft.note || null, executedAt }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to save.");
        return;
      }
      onSave();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const displaySym = toDisplaySymbol(tx.symbol);
  const meta = SIDE_META[tx.side];
  const showPrice = tx.side !== "deposit" && tx.side !== "withdrawal" && tx.side !== "fee";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-(--surface-container-high) p-6 shadow-2xl ring-1 ring-white/8">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${meta.color}`}>
              <MaterialIcon name={meta.icon} outlined={false} className="text-base" />
            </span>
            <div>
              <div className="text-sm font-bold text-strong">{meta.label} · {displaySym}</div>
              <div className="text-[11px] text-muted">{getFullCoinName(displaySym)}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-strong hover:bg-white/8 transition-colors">
            <MaterialIcon name="close" outlined={false} className="text-base" />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Quantity</span>
              <input
                type="number"
                value={draft.quantity}
                onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                className="input-base rounded-xl bg-(--surface-container-highest) px-3 py-2.5 text-sm text-strong"
                min="0"
                step="any"
              />
            </label>
            {showPrice && (
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Price (USD)</span>
                <input
                  type="number"
                  value={draft.priceUsd}
                  onChange={(e) => setDraft((d) => ({ ...d, priceUsd: e.target.value }))}
                  className="input-base rounded-xl bg-(--surface-container-highest) px-3 py-2.5 text-sm text-strong"
                  min="0"
                  step="any"
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Fee (USD)</span>
              <input
                type="number"
                value={draft.feeUsd}
                onChange={(e) => setDraft((d) => ({ ...d, feeUsd: e.target.value }))}
                className="input-base rounded-xl bg-(--surface-container-highest) px-3 py-2.5 text-sm text-strong"
                min="0"
                step="any"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Date &amp; Time</span>
              <input
                type="datetime-local"
                value={draft.executedAt}
                onChange={(e) => setDraft((d) => ({ ...d, executedAt: e.target.value }))}
                className="input-base rounded-xl bg-(--surface-container-highest) px-3 py-2.5 text-sm text-strong"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Note</span>
            <textarea
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              className="input-base resize-none rounded-xl bg-(--surface-container-highest) px-3 py-2.5 text-sm text-strong"
              rows={2}
              maxLength={200}
              placeholder="Optional note…"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="ui-button-secondary text-sm px-4 py-2">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="ui-button-primary text-sm px-4 py-2 disabled:opacity-60">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type PortfolioTransactionsListProps = {
  portfolioName: string;
  isConnected?: boolean;
  onTransactionChanged?: () => void;
};

export function PortfolioTransactionsList({
  portfolioName,
  isConnected = false,
  onTransactionChanged,
}: PortfolioTransactionsListProps) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TxSide | "all">("all");
  const [coinFilter, setCoinFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<TransactionRow | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithSupabaseAuth(
        `/api/portfolio/transactions?portfolioName=${encodeURIComponent(portfolioName)}&full=1&limit=200`,
        { signal: ctrl.signal }
      );
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json() as { transactions: TransactionRow[] };
      setTransactions(data.transactions ?? []);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError("Unable to load transactions.");
    } finally {
      setIsLoading(false);
    }
  }, [portfolioName]);

  useEffect(() => { void load(); }, [load]);

  // Unique coin options from loaded transactions
  const coinOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const tx of transactions) seen.add(toDisplaySymbol(tx.symbol));
    return [...seen].sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (typeFilter !== "all" && tx.side !== typeFilter) return false;
      if (coinFilter !== "all" && toDisplaySymbol(tx.symbol) !== coinFilter) return false;
      return true;
    });
  }, [transactions, typeFilter, coinFilter]);

  const handleDelete = async (tx: TransactionRow) => {
    if (!window.confirm(`Delete this ${SIDE_META[tx.side].label} transaction for ${toDisplaySymbol(tx.symbol)}? This cannot be undone.`)) return;
    setDeletingId(tx.id);
    try {
      const res = await fetchWithSupabaseAuth(
        `/api/portfolio/transactions/${tx.id}?portfolioName=${encodeURIComponent(portfolioName)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
        onTransactionChanged?.();
      } else {
        window.alert("Unable to delete transaction. Please try again.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSaved = () => {
    void load();
    onTransactionChanged?.();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="panel-base mb-6 overflow-hidden lg:mb-8">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <h3 className="section-title">Transactions</h3>
        <div className="flex items-center gap-2">
          {/* Type filter */}
          <div className="relative flex items-center gap-1.5 rounded-xl border border-white/8 bg-(--surface-container-highest) px-3 py-1.5">
            <MaterialIcon name="filter_list" outlined={false} className="text-[13px] text-muted" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TxSide | "all")}
              className="cursor-pointer appearance-none bg-transparent text-[11px] font-medium text-strong focus:outline-none pr-4"
            >
              <option value="all">All Types</option>
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>{SIDE_META[t].label}</option>
              ))}
            </select>
            <MaterialIcon name="expand_more" outlined={false} className="pointer-events-none absolute right-2 text-[12px] text-muted" />
          </div>

          {/* Coin filter */}
          <div className="relative flex items-center gap-1.5 rounded-xl border border-white/8 bg-(--surface-container-highest) px-3 py-1.5">
            <MaterialIcon name="toll" outlined={false} className="text-[13px] text-muted" />
            <select
              value={coinFilter}
              onChange={(e) => setCoinFilter(e.target.value)}
              className="cursor-pointer appearance-none bg-transparent text-[11px] font-medium text-strong focus:outline-none pr-4"
            >
              <option value="all">All Coins</option>
              {coinOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <MaterialIcon name="expand_more" outlined={false} className="pointer-events-none absolute right-2 text-[12px] text-muted" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="border-t border-white/5 text-[10px] font-bold uppercase tracking-widest text-muted">
            <tr>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Assets</th>
              <th className="px-6 py-3 text-right">Price</th>
              <th className="px-6 py-3 text-right">Amount</th>
              <th className="px-6 py-3 text-right">Fees</th>
              <th className="px-6 py-3">Notes</th>
              {!isConnected && <th className="px-6 py-3 text-right">Actions</th>}
            </tr>
          </thead>

          <tbody>
            {/* Loading skeleton */}
            {isLoading && (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-white/5 animate-pulse">
                  <td className="px-6 py-4"><div className="h-7 w-20 rounded-full bg-white/6" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-36 rounded bg-white/6" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-28 rounded bg-white/6" /></td>
                  <td className="px-6 py-4 text-right"><div className="ml-auto h-4 w-20 rounded bg-white/6" /></td>
                  <td className="px-6 py-4 text-right"><div className="ml-auto h-8 w-24 rounded bg-white/6" /></td>
                  <td className="px-6 py-4 text-right"><div className="ml-auto h-4 w-12 rounded bg-white/6" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-16 rounded bg-white/6" /></td>
                  {!isConnected && <td className="px-6 py-4" />}
                </tr>
              ))
            )}

            {/* Error */}
            {!isLoading && error && (
              <tr><td colSpan={isConnected ? 7 : 8} className="px-6 py-10 text-center text-sm text-danger">{error}</td></tr>
            )}

            {/* Empty */}
            {!isLoading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={isConnected ? 7 : 8} className="px-6 py-12 text-center">
                  <div className="text-base font-semibold text-strong">No transactions found</div>
                  <div className="mt-1 text-sm text-muted">
                    {transactions.length === 0 ? "Add your first transaction to get started." : "Try adjusting the filters."}
                  </div>
                </td>
              </tr>
            )}

            {/* Rows */}
            {!isLoading && !error && filtered.map((tx) => {
              const displaySym = toDisplaySymbol(tx.symbol);
              const meta = SIDE_META[tx.side];
              const isIncoming = tx.side === "buy" || tx.side === "deposit" || tx.side === "airdrop";
              const amountSign = isIncoming ? "+" : "-";
              const amountColor = isIncoming ? "text-[#0ecb81]" : "text-[#f6465d]";
              const totalUsd = tx.quantity * tx.price_usd;

              return (
                <tr key={tx.id} className="group border-t border-white/5 transition-colors hover:bg-(--surface-container-low)">
                  {/* Type */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.color}`}>
                      <MaterialIcon name={meta.icon} outlined={false} className="text-[12px]" />
                      {meta.label}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted">
                    {fmtDate(tx.executed_at)}
                  </td>

                  {/* Asset */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--surface-container-highest) text-warning">
                        <MaterialIcon name="currency_bitcoin" outlined={false} className="text-xs" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-strong">{getFullCoinName(displaySym)}</div>
                        <div className="text-[11px] font-medium text-muted">{displaySym}</div>
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-strong">
                    {tx.price_usd > 0 ? usdFmt.format(tx.price_usd) : "--"}
                  </td>

                  {/* Amount */}
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className={`text-sm font-bold ${amountColor}`}>
                      {amountSign}{fmtQty(tx.quantity, tx.symbol)}
                    </div>
                    {totalUsd > 0 && (
                      <div className="text-[11px] text-muted">{usdFmt.format(totalUsd)}</div>
                    )}
                  </td>

                  {/* Fee */}
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-muted">
                    {fmtUsd(tx.fee_usd)}
                  </td>

                  {/* Note */}
                  <td className="px-6 py-4 text-sm text-muted max-w-[160px]">
                    {tx.note ? (
                      <span className="block truncate" title={tx.note}>{tx.note}</span>
                    ) : "--"}
                  </td>

                  {/* Actions */}
                  {!isConnected && (
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          title="Edit transaction"
                          onClick={() => setEditingTx(tx)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-white/8 hover:text-strong transition-colors"
                        >
                          <MaterialIcon name="edit" outlined={false} className="text-sm" />
                        </button>
                        <button
                          type="button"
                          title="Delete transaction"
                          onClick={() => handleDelete(tx)}
                          disabled={deletingId === tx.id}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-[#f6465d]/10 hover:text-[#f6465d] transition-colors disabled:opacity-40"
                        >
                          <MaterialIcon name="delete" outlined={false} className="text-sm" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {!isLoading && !error && filtered.length > 0 && (
        <div className="border-t border-white/5 px-6 py-3 text-right text-[11px] text-muted">
          {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== transactions.length ? ` (filtered from ${transactions.length})` : ""}
        </div>
      )}

      {/* Edit modal */}
      {editingTx && (
        <EditModal
          tx={editingTx}
          portfolioName={portfolioName}
          onSave={handleEditSaved}
          onClose={() => setEditingTx(null)}
        />
      )}
    </section>
  );
}
