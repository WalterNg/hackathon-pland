"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "../dashboard/material-icon";
import type { PortfolioMode } from "@/app/lib/portfolio-types";

type CreatePortfolioDialogProps = {
  open: boolean;
  defaultName: string;
  onClose: () => void;
  onSubmit: (name: string, mode: PortfolioMode) => Promise<void>;
};

export function CreatePortfolioDialog({ open, defaultName, onClose, onSubmit }: CreatePortfolioDialogProps) {
  const SERVER_DEMO_MASK = "server-demo-credential";
  const [name, setName] = useState(defaultName);
  const [mode, setMode] = useState<PortfolioMode>("manual");
  const [connectionMode, setConnectionMode] = useState<"demo" | "testnet">("demo");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [useServerDemoCredentials, setUseServerDemoCredentials] = useState(false);
  const [isLoadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<{
    exchange: "binance";
    mode: "demo" | "testnet";
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
      setConnectionMode("demo");
      setApiKey("");
      setApiSecret("");
      setUseServerDemoCredentials(false);
      setError(null);
      setPreview(null);
      setLoadingPreview(false);
    }
  }, [open, defaultName]);

  if (!open) {
    return null;
  }

  const apiKeyInputValue = useServerDemoCredentials ? SERVER_DEMO_MASK : apiKey;
  const apiSecretInputValue = useServerDemoCredentials ? SERVER_DEMO_MASK : apiSecret;
  const canSubmit = name.trim().length > 0 && (mode !== "binance_connected" || Boolean(preview));

  const applyServerDemoCredentials = () => {
    if (connectionMode !== "demo") {
      return;
    }

    setApiKey("");
    setApiSecret("");
    setUseServerDemoCredentials(true);
    setPreview(null);
    setError(null);
  };

  const loadPreview = async () => {
    const hasManualCredentials = Boolean(apiKey.trim() && apiSecret.trim());
    const canUseServerDemo = connectionMode === "demo" && useServerDemoCredentials;

    if (!hasManualCredentials && !canUseServerDemo) {
      setError("API key and secret are required for Binance preview.");
      return;
    }

    setLoadingPreview(true);
    setError(null);

    try {
      const response = await fetch("/api/binance/connection/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: connectionMode,
          api_key: hasManualCredentials ? apiKey.trim() : undefined,
          api_secret: hasManualCredentials ? apiSecret.trim() : undefined,
          include_zero_balances: false,
          recv_window_ms: 5000
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            status?: string;
            data?: typeof preview;
            error?: string;
            detail?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? payload?.detail ?? "Unable to load Binance preview.");
      }

      setPreview(payload?.data ?? null);
    } catch (previewError) {
      setPreview(null);
      setError(previewError instanceof Error ? previewError.message : "Unable to load Binance preview.");
    } finally {
      setLoadingPreview(false);
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
      await onSubmit(trimmed, mode);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create portfolio.");
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
      <div className="modal-shell max-w-sm p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-strong">Create Portfolio</h2>
          <button type="button" onClick={onClose} className="icon-button h-10 w-10" aria-label="Close">
            <MaterialIcon name="close" outlined={false} className="text-xl" />
          </button>
        </div>

        <label className="field-label">Portfolio name</label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. DeFi, Long-term holds"
          autoFocus
          className="field-input mb-4"
        />

        <div className="mb-4">
          <label className="field-label">Choose setup mode</label>
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                mode === "manual"
                  ? "border-primary bg-(--surface-container-highest)"
                  : "border-(--surface-outline) bg-(--surface-container-low)"
              }`}
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                <MaterialIcon name="edit" outlined={false} className="text-base" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-strong">Manually add transactions</span>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  Keep full control and enter buys, sells, deposits, and withdrawals by hand.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode("binance_connected")}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                mode === "binance_connected"
                  ? "border-primary bg-(--surface-container-highest)"
                  : "border-(--surface-outline) bg-(--surface-container-low)"
              }`}
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
                <MaterialIcon name="link" outlined={false} className="text-base" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-strong">Connect Binance account</span>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  Sync balances automatically and disable manual edits for this portfolio.
                </span>
              </span>
            </button>
          </div>
        </div>

        {mode === "binance_connected" ? (
          <div className="panel-low mb-4 border border-(--surface-outline) p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">Preview</p>
                <h3 className="mt-1 text-sm font-semibold text-strong">Binance connection preview</h3>
              </div>
              <span className="rounded-full bg-warning-soft px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-warning">
                {connectionMode}
              </span>
            </div>

            <p className="mt-2 text-xs leading-5 text-muted">
              Connect using Binance Demo or Binance Testnet, then review the balances before activation.
            </p>

            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setConnectionMode("demo");
                    setApiKey("");
                    setApiSecret("");
                    setUseServerDemoCredentials(false);
                    setPreview(null);
                    setError(null);
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    connectionMode === "demo"
                      ? "border-primary bg-(--surface-container-highest)"
                      : "border-(--surface-outline) bg-(--surface-container-low)"
                  }`}
                >
                  <span className="block text-sm font-semibold text-strong">Demo</span>
                  <span className="mt-1 block text-xs leading-5 text-muted">Binance demo API.</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConnectionMode("testnet");
                    setApiKey("");
                    setApiSecret("");
                    setUseServerDemoCredentials(false);
                    setPreview(null);
                    setError(null);
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    connectionMode === "testnet"
                      ? "border-primary bg-(--surface-container-highest)"
                      : "border-(--surface-outline) bg-(--surface-container-low)"
                  }`}
                >
                  <span className="block text-sm font-semibold text-strong">Testnet</span>
                  <span className="mt-1 block text-xs leading-5 text-muted">Binance Spot testnet.</span>
                </button>
              </div>

              <div>
                <label className="field-label">API Key</label>
                <input
                  type="password"
                  value={apiKeyInputValue}
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    setUseServerDemoCredentials(false);
                    setPreview(null);
                  }}
                  placeholder="Binance API key"
                  className="field-input"
                />
              </div>

              <div>
                <label className="field-label">API Secret</label>
                <input
                  type="password"
                  value={apiSecretInputValue}
                  onChange={(event) => {
                    setApiSecret(event.target.value);
                    setUseServerDemoCredentials(false);
                    setPreview(null);
                  }}
                  placeholder="Binance API secret"
                  className="field-input"
                />
              </div>

              {connectionMode === "demo" ? (
                <button
                  type="button"
                  onClick={applyServerDemoCredentials}
                  className="ui-button-secondary w-full disabled:opacity-60"
                >
                  Use demo credentials
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => void loadPreview()}
                disabled={isLoadingPreview || (!useServerDemoCredentials && (!apiKey.trim() || !apiSecret.trim()))}
                className="ui-button-secondary w-full disabled:opacity-60"
              >
                {isLoadingPreview ? "Loading preview..." : "Load preview"}
              </button>

              {preview ? (
                <div className="rounded-2xl border border-(--surface-outline) bg-(--surface-container-low) p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">Result</p>
                      <h4 className="mt-1 text-sm font-semibold text-strong">
                        {preview.mode === "demo" ? "Demo balances" : "Testnet balances"}
                      </h4>
                    </div>
                    <div className="text-right text-xs text-muted">
                      <div>{preview.totals.non_zero_asset_count} active assets</div>
                      <div>{preview.totals.total_estimated_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD</div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {preview.assets.map((asset) => (
                      <div
                        key={asset.asset}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-(--surface-outline) bg-(--surface-container-highest) px-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-semibold text-strong">{asset.asset}</p>
                          <p className="text-xs text-muted">
                            Qty: {asset.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-strong">
                          {asset.estimated_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                        </p>
                      </div>
                    ))}
                  </div>

                  {preview.warnings.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {preview.warnings.map((warning) => (
                        <div
                          key={warning.code}
                          className="rounded-xl border border-warning/30 bg-warning-soft/40 px-3 py-2 text-xs text-warning"
                        >
                          {warning.message}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {error && <div className="panel-low mb-3 p-3 text-xs text-danger sm:text-sm">{error}</div>}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="ui-button-secondary disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="ui-button-primary disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : mode === "binance_connected" ? "Connect & create" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
