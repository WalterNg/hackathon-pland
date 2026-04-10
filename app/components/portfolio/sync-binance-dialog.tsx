"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "../dashboard/material-icon";
import { formatLocaleNumber } from "@/app/lib/number-format";

type BinanceAsset = {
  asset: string;
  quantity: number;
  price_usd: number;
  estimated_usd: number;
  is_stablecoin: boolean;
};

type SyncBinanceDialogProps = {
  open: boolean;
  portfolioName: string;
  onClose: () => void;
  onSync: (assets: Array<{ asset: string; quantity: number; price_usd: number }>) => Promise<void>;
};

export function SyncBinanceDialog({ open, portfolioName, onClose, onSync }: SyncBinanceDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [isLoadingPreview, setLoadingPreview] = useState(false);
  const [isLoadingQuickDemo, setLoadingQuickDemo] = useState(false);
  const [isSyncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState<{
    assets: BinanceAsset[];
    totals: { non_zero_asset_count: number; total_estimated_usd: number };
    warnings: Array<{ code: string; message: string; severity: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setApiKey("");
      setApiSecret("");
      setShowApiSecret(false);
      setPreview(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const loadDemoPreview = async (overrideApiKey?: string, overrideApiSecret?: string) => {
    const apiKeyValue = (overrideApiKey ?? apiKey).trim();
    const apiSecretValue = (overrideApiSecret ?? apiSecret).trim();

    if (!apiKeyValue || !apiSecretValue) {
      setError("API Key and API Secret are required.");
      return;
    }

    setLoadingPreview(true);
    setError(null);
    setPreview(null);

    try {
      const response = await fetch("/api/binance/connection/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "demo", api_key: apiKeyValue, api_secret: apiSecretValue, include_zero_balances: false, recv_window_ms: 5000 }),
      });

      const payload = (await response.json().catch(() => null)) as { status?: string; data?: typeof preview; error?: string; detail?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? payload?.detail ?? "Unable to load preview.");
      setPreview(payload?.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load preview.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const loadQuickDemo = async () => {
    setLoadingQuickDemo(true);
    setError(null);
    try {
      const response = await fetch("/api/binance/connection/demo-credentials", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { apiKey?: string; apiSecret?: string; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Unable to load demo credentials.");
      if (!payload?.apiKey || !payload?.apiSecret) throw new Error("Demo credentials are missing.");
      setApiKey(payload.apiKey);
      setApiSecret(payload.apiSecret);
      setPreview(null);
      await loadDemoPreview(payload.apiKey, payload.apiSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load demo credentials.");
    } finally {
      setLoadingQuickDemo(false);
    }
  };

  const handleSync = async () => {
    if (!preview) return;
    setSyncing(true);
    setError(null);
    try {
      const assets = preview.assets.map((a) => ({ asset: a.asset, quantity: a.quantity, price_usd: a.price_usd }));
      await onSync(assets);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync portfolio.");
    } finally {
      setSyncing(false);
    }
  };

  const demoSkeletonRows = [
    { balanceWidth: "w-24", valueWidth: "w-16" },
    { balanceWidth: "w-20", valueWidth: "w-14" },
    { balanceWidth: "w-24", valueWidth: "w-20" },
  ];

  return (
    <div className="modal-backdrop z-90">
      <div className="modal-shell max-h-[96vh] w-full max-w-3xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Binance Sync</p>
            <h2 className="text-[1.4rem] font-bold leading-none tracking-tight text-strong">{portfolioName}</h2>
          </div>
          <button type="button" onClick={onClose} className="icon-button h-10 w-10" aria-label="Close">
            <MaterialIcon name="close" outlined={false} className="text-xl" />
          </button>
        </div>

        <div className="max-h-[calc(96vh-150px)] overflow-y-auto px-5 pt-1 pb-4 sm:px-6 sm:pt-2 sm:pb-5">
          <p className="mb-5 text-sm text-muted">
            Fetch current balances from your Binance account and create adjustment transactions to match this portfolio.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* LEFT: credentials */}
            <section className="panel-low flex flex-col gap-5 rounded-2xl border border-(--surface-outline) p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Connection</p>
                  <h3 className="mt-0.5 text-base font-semibold text-strong">Binance Credentials</h3>
                </div>
                <span className="inline-flex items-center justify-center rounded-full border border-warning/30 bg-warning-soft px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-warning">
                  Demo
                </span>
              </div>

              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-strong">Credentials</span>
                  <button
                    type="button"
                    onClick={() => void loadQuickDemo()}
                    disabled={isLoadingQuickDemo}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning-soft px-2.5 py-1 text-[0.68rem] font-semibold text-warning transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-warning/60 hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <MaterialIcon name="bolt" outlined={false} className="text-[0.85rem]" />
                    {isLoadingQuickDemo ? "Loading..." : "Quick Demo"}
                  </button>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-[0.68rem] font-medium text-muted">API Key</label>
                  <div className="field-input flex items-center gap-2 overflow-hidden p-0! focus-within:shadow-none focus-within:ring-0">
                    <span className="flex shrink-0 items-center pl-3 text-muted/50">
                      <MaterialIcon name="key" outlined={false} className="text-base" />
                    </span>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); setPreview(null); setError(null); }}
                      placeholder="Paste your API key"
                      className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm outline-none ring-0"
                      style={{ boxShadow: "none", outline: "none" }}
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-[0.68rem] font-medium text-muted">API Secret</label>
                  <div className="field-input flex items-center gap-2 overflow-hidden p-0! focus-within:shadow-none focus-within:ring-0">
                    <span className="flex shrink-0 items-center pl-3 text-muted/50">
                      <MaterialIcon name="lock" outlined={false} className="text-base" />
                    </span>
                    <input
                      type={showApiSecret ? "text" : "password"}
                      value={apiSecret}
                      onChange={(e) => { setApiSecret(e.target.value); setPreview(null); setError(null); }}
                      placeholder="Paste your API secret"
                      className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none ring-0"
                      style={{ boxShadow: "none", outline: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiSecret((v) => !v)}
                      className="flex shrink-0 items-center pr-3 text-muted/60 transition hover:text-strong focus:outline-none"
                      aria-label={showApiSecret ? "Hide secret" : "Show secret"}
                    >
                      <MaterialIcon name={showApiSecret ? "visibility_off" : "visibility"} outlined={false} className="text-base" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-auto">
                <button
                  type="button"
                  onClick={() => void loadDemoPreview()}
                  disabled={isLoadingPreview}
                  className="ui-button-tonal-success flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold tracking-wide transition-all duration-200 ease-out hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoadingPreview ? (
                    <>
                      <span className="spinner-ring-success h-4 w-4 animate-spin rounded-full border-2" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <MaterialIcon name="refresh" outlined={false} className="text-base" />
                      Load Preview
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* RIGHT: preview */}
            <section className="panel-low flex flex-col gap-5 rounded-2xl border border-(--surface-outline) p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Binance Balances</p>
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
                  <div className="flex h-full flex-col">
                    <div className="grid grid-cols-[1.1fr_1fr_0.8fr] gap-4 pb-3 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">
                      <span>Asset</span>
                      <span>Balance</span>
                      <span className="text-right">Value</span>
                    </div>
                    <div className="grid gap-2">
                      {demoSkeletonRows.map((row, index) => (
                        <div key={index} className="animate-pulse grid grid-cols-[1.1fr_1fr_0.8fr] items-center gap-4 py-2">
                          <div className="h-2 w-20 rounded-full bg-white/10" />
                          <div className={`h-2 rounded-full bg-white/10 ${row.balanceWidth}`} />
                          <div className={`ml-auto h-2 rounded-full bg-white/10 ${row.valueWidth}`} />
                        </div>
                      ))}
                    </div>
                    <p className="mt-auto pt-4 text-xs leading-5 text-muted">
                      Load a preview to see your Binance balances before syncing.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <div className="grid grid-cols-[1.1fr_1fr_0.8fr] gap-4 pb-1 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">
                      <span>Asset</span>
                      <span>Balance</span>
                      <span className="text-right">Value (USD)</span>
                    </div>
                    {preview.assets.map((asset) => (
                      <div
                        key={asset.asset}
                        className="grid grid-cols-[1.1fr_1fr_0.8fr] items-center gap-4 rounded-xl border border-(--surface-outline) bg-(--surface-container-highest) px-4 py-2.5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/25"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-[0.65rem] font-bold text-strong">
                            {asset.asset.slice(0, 3)}
                          </span>
                          <span className="text-sm font-semibold text-strong">{asset.asset}</span>
                        </div>
                        <p className="text-xs text-muted">{formatLocaleNumber(asset.quantity, { maximumFractionDigits: 6 })}</p>
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

          {error ? <div className="panel-low mt-4 p-3 text-xs text-danger sm:text-sm">{error}</div> : null}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="ui-button-secondary disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={!preview || isSyncing}
            className="ui-button-primary flex items-center gap-2 disabled:opacity-60"
          >
            {isSyncing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Syncing…
              </>
            ) : (
              <>
                <MaterialIcon name="sync" outlined={false} className="text-base" />
                Sync Balances
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
