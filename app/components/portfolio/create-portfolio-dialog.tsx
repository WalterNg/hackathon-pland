"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "../dashboard/material-icon";
import type { PortfolioMode } from "@/app/lib/portfolio-types";
import { formatLocaleNumber } from "@/app/lib/number-format";

type CreatePortfolioDialogProps = {
  open: boolean;
  defaultName: string;
  onClose: () => void;
  onSubmit: (name: string, mode: PortfolioMode, idempotencyKey?: string, assets?: Array<{ asset: string; quantity: number; price_usd: number }>) => Promise<void>;
};

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `setup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CreatePortfolioDialog({ open, defaultName, onClose, onSubmit }: CreatePortfolioDialogProps) {
  const [name, setName] = useState(defaultName);
  const [mode, setMode] = useState<PortfolioMode>("manual");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [setupIdempotencyKey, setSetupIdempotencyKey] = useState<string>(createIdempotencyKey());
  const [isSubmitting, setSubmitting] = useState(false);
  const [isLoadingQuickDemo, setLoadingQuickDemo] = useState(false);
  const [isLoadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<{
    exchange: "binance";
    account: {
      account_type: string | null;
      can_trade: boolean;
      can_withdraw: boolean;
      can_deposit: boolean;
      update_time: number | null;
    };
    assets: Array<{
      asset: string;
      free: number;
      locked: number;
      quantity: number;
      price_usd: number;
      estimated_usd: number;
      is_stablecoin: boolean;
    }>;
    totals: {
      asset_count: number;
      non_zero_asset_count: number;
      total_estimated_usd: number;
    };
    warnings: Array<{
      code: string;
      message: string;
      severity: "info" | "warning" | "critical";
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setMode("manual");
      setApiKey("");
      setApiSecret("");
      setShowApiSecret(false);
      setSetupIdempotencyKey(createIdempotencyKey());
      setError(null);
      setPreview(null);
      setLoadingQuickDemo(false);
      setLoadingPreview(false);
    }
  }, [open, defaultName]);

  if (!open) {
    return null;
  }

  const canSubmit = name.trim().length > 0 && (mode !== "binance_connected" || Boolean(preview));
  const demoSkeletonRows = [
    { balanceWidth: "w-24", valueWidth: "w-16" },
    { balanceWidth: "w-20", valueWidth: "w-14" },
    { balanceWidth: "w-24", valueWidth: "w-20" },
    { balanceWidth: "w-16", valueWidth: "w-16" }
  ];
  const optionCardBase =
    "group flex h-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-all duration-200 ease-out will-change-transform hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(0,0,0,0.22)]";

  const loadDemoPreview = async (overrideApiKey?: string, overrideApiSecret?: string) => {
    const apiKeyValue = (overrideApiKey ?? apiKey).trim();
    const apiSecretValue = (overrideApiSecret ?? apiSecret).trim();

    if (!apiKeyValue || !apiSecretValue) {
      setError("API Key and API Secret are required before loading preview.");
      return;
    }

    setLoadingPreview(true);
    setError(null);
    setPreview(null);

    try {
      const response = await fetch("/api/binance/connection/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKeyValue,
          api_secret: apiSecretValue,
          include_zero_balances: false,
          recv_window_ms: 5000
        })
      });

      const responsePayload = (await response.json().catch(() => null)) as
        | {
            status?: string;
            data?: typeof preview;
            error?: string;
            detail?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(responsePayload?.error ?? responsePayload?.detail ?? "Unable to load Binance preview.");
      }

      setPreview(responsePayload?.data ?? null);
    } catch (previewError) {
      setPreview(null);
      setError(previewError instanceof Error ? previewError.message : "Unable to load Binance preview.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const loadQuickDemo = async () => {
    setLoadingQuickDemo(true);
    setError(null);

    try {
      const response = await fetch("/api/binance/connection/demo-credentials", {
        method: "GET",
        cache: "no-store"
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            apiKey?: string;
            apiSecret?: string;
            error?: string;
            hint?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? payload?.hint ?? "Unable to load demo credentials.");
      }

      if (!payload?.apiKey || !payload?.apiSecret) {
        throw new Error("Demo credentials are missing.");
      }

      setPreview(null);
      await loadDemoPreview(payload.apiKey, payload.apiSecret);
    } catch (demoKeyError) {
      setError(demoKeyError instanceof Error ? demoKeyError.message : "Unable to load demo credentials.");
    } finally {
      setLoadingQuickDemo(false);
    }
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const assets = mode === "binance_connected" && preview
        ? preview.assets.map((a) => ({ asset: a.asset, quantity: a.quantity, price_usd: a.price_usd }))
        : undefined;
      await onSubmit(trimmed, mode, setupIdempotencyKey, assets);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create portfolio.");
      setSetupIdempotencyKey(createIdempotencyKey());
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && canSubmit && !isSubmitting) {
      void handleSubmit();
    }
  };

  return (
    <div className="modal-backdrop z-90">
      <div className="modal-shell max-h-[96vh] w-full max-w-3xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="flex items-center">
            <h2 className="text-[1.65rem] font-bold leading-none tracking-tight text-strong">Create Portfolio</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-button h-10 w-10 transition-all duration-200 ease-out hover:scale-105 hover:bg-(--surface-bright)"
            aria-label="Close"
          >
            <MaterialIcon name="close" outlined={false} className="text-xl" />
          </button>
        </div>

        <div className="max-h-[calc(96vh-150px)] overflow-y-auto px-5 pt-1 pb-4 sm:px-6 sm:pt-2 sm:pb-5">
          <label className="field-label">Portfolio name</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. DeFi, Long-term holds"
            autoFocus
            className="field-input mb-5"
          />

          <div className="mb-5">
            <label className="field-label mb-3 block">
              Choose setup mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`${optionCardBase} ${
                  mode === "manual"
                    ? "border-primary/70 bg-(--surface-container-highest) shadow-[0_0_0_1px_rgba(60,227,106,0.18),0_12px_28px_rgba(0,0,0,0.22)]"
                    : "border-(--surface-outline) bg-(--surface-container-low) hover:border-primary/35 hover:bg-(--surface-bright)"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success transition-all duration-200 ease-out group-hover:scale-105 group-hover:bg-success/15">
                  <MaterialIcon name="edit" outlined={false} className="text-base" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-strong">Manually add transactions</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMode("binance_connected")}
                className={`${optionCardBase} ${
                  mode === "binance_connected"
                    ? "border-primary/70 bg-(--surface-container-highest) shadow-[0_0_0_1px_rgba(60,227,106,0.18),0_12px_28px_rgba(0,0,0,0.22)]"
                    : "border-(--surface-outline) bg-(--surface-container-low) hover:border-primary/35 hover:bg-(--surface-bright)"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning transition-all duration-200 ease-out group-hover:scale-105 group-hover:bg-warning/15">
                  <MaterialIcon name="link" outlined={false} className="text-base" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-strong">Connect Binance account</span>
                </span>
              </button>
            </div>
          </div>

          {mode === "binance_connected" ? (
            <div className="grid grid-cols-2 gap-4">
              {/* ── LEFT: Connection setup ─────────────────────────────── */}
              <section className="panel-low flex flex-col gap-5 rounded-2xl border border-(--surface-outline) p-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Connection</p>
                    <h3 className="mt-0.5 text-base font-semibold text-strong">Binance Setup</h3>
                  </div>
                  <span className="inline-flex items-center justify-center rounded-full border border-warning/30 bg-warning-soft px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-warning">
                    Demo
                  </span>
                </div>


                {/* Credentials */}
                <div className="grid gap-4">
                  {/* Quick-fill row */}
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-strong">Credentials</span>
                    <button
                      type="button"
                      onClick={() => void loadQuickDemo()}
                      disabled={isLoadingQuickDemo}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning-soft px-2.5 py-1 text-[0.68rem] font-semibold text-warning transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-warning/60 hover:bg-warning/15 hover:shadow-[0_10px_20px_rgba(255,184,106,0.12)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    >
                      <MaterialIcon name="bolt" outlined={false} className="text-[0.85rem]" />
                      {isLoadingQuickDemo ? "Loading..." : "Quick Demo"}
                    </button>
                  </div>

                  {/* API Key */}
                  <div className="grid gap-1.5">
                    <label className="text-[0.68rem] font-medium text-muted">API Key</label>
                    <div className="field-input flex items-center gap-2 p-0! overflow-hidden focus-within:ring-0 focus-within:shadow-none">
                      <span className="flex shrink-0 items-center pl-3 text-muted/50">
                        <MaterialIcon name="key" outlined={false} className="text-base" />
                      </span>
                      <input
                        type="text"
                        value={apiKey}
                        onChange={(e) => { setApiKey(e.target.value); setPreview(null); setError(null); }}
                        placeholder="Paste your API key"
                        className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm outline-none ring-0 focus:outline-none focus:ring-0"
                        style={{ boxShadow: "none", outline: "none" }}
                      />
                    </div>
                  </div>

                  {/* API Secret */}
                  <div className="grid gap-1.5">
                    <label className="text-[0.68rem] font-medium text-muted">API Secret</label>
                    <div className="field-input flex items-center gap-2 p-0! overflow-hidden focus-within:ring-0 focus-within:shadow-none">
                      <span className="flex shrink-0 items-center pl-3 text-muted/50">
                        <MaterialIcon name="lock" outlined={false} className="text-base" />
                      </span>
                      <input
                        type={showApiSecret ? "text" : "password"}
                        value={apiSecret}
                        onChange={(e) => { setApiSecret(e.target.value); setPreview(null); setError(null); }}
                        placeholder="Paste your API secret"
                        className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none ring-0 focus:outline-none focus:ring-0"
                        style={{ boxShadow: "none", outline: "none" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiSecret((v) => !v)}
                        className="flex shrink-0 items-center pr-3 text-muted/60 transition hover:text-strong focus:outline-none focus:ring-0"
                        aria-label={showApiSecret ? "Hide secret" : "Show secret"}
                      >
                        <MaterialIcon name={showApiSecret ? "visibility_off" : "visibility"} outlined={false} className="text-base" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-auto">
                  <button
                    type="button"
                    onClick={() => void loadDemoPreview()}
                    disabled={isLoadingPreview}
                    className="ui-button-tonal-success flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold tracking-wide transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    {isLoadingPreview ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400/40 border-t-emerald-300" />
                        Loading…
                      </>
                    ) : (
                      <>
                        <MaterialIcon name="play_circle" outlined={false} className="text-base" />
                        Load Preview
                      </>
                    )}
                  </button>
                </div>
              </section>

              {/* ── RIGHT: Preview result ──────────────────────────────── */}
              <section className="panel-low flex flex-col gap-5 rounded-2xl border border-(--surface-outline) p-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Result</p>
                    <h4 className="mt-0.5 text-base font-semibold text-strong">
                      {preview ? "Preview Ready" : "No preview loaded"}
                    </h4>
                  </div>
                  {preview ? (
                    <div className="text-right">
                      <p className="text-sm font-semibold text-strong">
                        ${formatLocaleNumber(preview.totals.total_estimated_usd, { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-[0.68rem] text-muted">{preview.totals.non_zero_asset_count} assets</p>
                    </div>
                  ) : null}
                </div>

                <div className="flex-1">
                  {!preview ? (
                    /* Empty / skeleton state */
                    <div className="flex h-full flex-col">
                      {/* Column headers */}
                      <div className="grid grid-cols-[1.1fr_1fr_0.8fr] gap-4 pb-3 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">
                        <span>Asset</span>
                        <span>Balance</span>
                        <span className="text-right">Value</span>
                      </div>
                      <div className="grid gap-2">
                        {demoSkeletonRows.map((row, index) => (
                          <div
                            key={index}
                            className="animate-pulse grid grid-cols-[1.1fr_1fr_0.8fr] items-center gap-4 py-2"
                          >
                            <div className="h-2 w-20 rounded-full bg-white/10" />
                            <div className={`h-2 rounded-full bg-white/10 ${row.balanceWidth}`} />
                            <div className={`ml-auto h-2 rounded-full bg-white/10 ${row.valueWidth}`} />
                          </div>
                        ))}
                      </div>
                      <p className="mt-auto pt-4 text-xs leading-5 text-muted">
                        Load a preview to validate your balances before creating the portfolio.
                      </p>
                    </div>
                  ) : (
                    /* Loaded state */
                    <div className="grid gap-2">
                      {/* Column headers */}
                      <div className="grid grid-cols-[1.1fr_1fr_0.8fr] gap-4 pb-1 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">
                        <span>Asset</span>
                        <span>Balance</span>
                        <span className="text-right">Value (USD)</span>
                      </div>
                      {preview.assets.map((asset) => (
                        <div
                          key={asset.asset}
                          className="grid grid-cols-[1.1fr_1fr_0.8fr] items-center gap-4 rounded-xl border border-(--surface-outline) bg-(--surface-container-highest) px-4 py-2.5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/25 hover:bg-(--surface-bright) hover:shadow-[0_10px_22px_rgba(0,0,0,0.18)]"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-[0.65rem] font-bold text-strong">
                              {asset.asset.slice(0, 3)}
                            </span>
                            <span className="text-sm font-semibold text-strong">{asset.asset}</span>
                          </div>
                          <p className="text-xs text-muted">
                            {formatLocaleNumber(asset.quantity, { maximumFractionDigits: 6 })}
                          </p>
                          <p className="text-right text-sm font-semibold text-strong">
                            ${formatLocaleNumber(asset.estimated_usd, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      ))}

                      {preview.warnings.length > 0 && (
                        <div className="mt-1 grid gap-2">
                          {preview.warnings.map((w) => (
                            <div key={w.code} className="rounded-xl border border-warning/30 bg-warning-soft/40 px-3 py-2 text-xs text-warning">
                              {w.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {error ? <div className="panel-low mt-4 p-3 text-xs text-danger sm:text-sm">{error}</div> : null}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="ui-button-secondary transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-(--surface-bright) hover:text-strong disabled:opacity-60 disabled:hover:translate-y-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="ui-button-primary transition-all duration-200 ease-out hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {isSubmitting ? "Creating..." : mode === "binance_connected" ? "Connect & create" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
