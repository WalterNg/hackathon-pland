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
  const [name, setName] = useState(defaultName);
  const [mode, setMode] = useState<PortfolioMode>("manual");
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setMode("manual");
      setError(null);
    }
  }, [open, defaultName]);

  if (!open) {
    return null;
  }

  const canSubmit = name.trim().length > 0;

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
            {isSubmitting ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
