"use client";

import { useState } from "react";
import { MaterialIcon } from "../dashboard/material-icon";

type CreatePortfolioDialogProps = {
  open: boolean;
  defaultName: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
};

export function CreatePortfolioDialog({ open, defaultName, onClose, onSubmit }: CreatePortfolioDialogProps) {
  const [name, setName] = useState(defaultName);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await onSubmit(trimmed);
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-strong">Create Portfolio</h2>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-body" aria-label="Close">
            <MaterialIcon name="close" outlined={false} className="text-2xl" />
          </button>
        </div>

        <label className="mb-2 block text-sm font-semibold text-body">Portfolio name</label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. DeFi, Long-term holds"
          autoFocus
          className="mb-5 w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-semibold text-strong outline-none ring-primary focus:ring-2"
        />

        {error && <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 text-sm text-danger">{error}</div>}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-strong transition hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:bg-primary-hover disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
