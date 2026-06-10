"use client";

import { useRef, useState, useEffect } from "react";
import { MaterialIcon } from "../dashboard/material-icon";
import { CertifySnapshotButton } from "./certify-snapshot-button";

type PortfolioHeaderProps = {
  portfolioName: string;
  statusLabel?: string;
  statusDescription?: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  isPrimaryActionDisabled?: boolean;
  onRemovePortfolio?: () => void;
  showRemovePortfolio?: boolean;
  isRemovingPortfolio?: boolean;
  showCharts: boolean;
  onToggleShowCharts: () => void;
  isConnectedPortfolio?: boolean;
  onSync?: () => void;
  isSyncing?: boolean;
  onCertifySnapshot?: () => void;
  isCertifyingSnapshot?: boolean;
  isCertifySnapshotDisabled?: boolean;
  hideActions?: boolean;
};

export function PortfolioHeader({
  portfolioName,
  statusLabel,
  statusDescription,
  primaryActionLabel,
  onPrimaryAction,
  isPrimaryActionDisabled = false,
  onRemovePortfolio,
  showRemovePortfolio = false,
  isRemovingPortfolio = false,
  showCharts,
  onToggleShowCharts,
  isConnectedPortfolio = false,
  onSync,
  isSyncing = false,
  onCertifySnapshot,
  isCertifyingSnapshot = false,
  isCertifySnapshotDisabled = false,
  hideActions = false,
}: PortfolioHeaderProps) {
  const isReadOnlyStatus = isPrimaryActionDisabled && primaryActionLabel === "Read-only";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const hasMenuItems =
    (showCharts !== undefined && onToggleShowCharts !== undefined) ||
    (isConnectedPortfolio && onSync) ||
    (showRemovePortfolio && onRemovePortfolio);

  return (
    <section className="mb-6 flex min-h-[44px] flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="typo-h1 text-strong">{portfolioName}</h1>
          {statusLabel ? (
            <span className="inline-flex items-center rounded-full border border-(--surface-outline) bg-(--surface-container-low) px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">
              {statusLabel}
            </span>
          ) : null}
        </div>
        {statusDescription ? <p className="mt-2 max-w-xl text-sm italic text-muted">{statusDescription}</p> : null}
      </div>

      {!hideActions && (
        <div className="flex flex-wrap items-center gap-3">
          {isReadOnlyStatus ? (
            <span className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-(--surface-outline) bg-(--surface-container-low) px-4 text-[0.8rem] font-semibold tracking-wide text-muted">
              <MaterialIcon name="lock" outlined={false} className="text-[1rem]" />
              {primaryActionLabel}
            </span>
          ) : (
            <button
              type="button"
              onClick={onPrimaryAction}
              disabled={isPrimaryActionDisabled}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[0.75rem] font-semibold tracking-wide text-[var(--text-on-primary)] shadow-[0_2px_12px_-3px_rgba(var(--color-primary-rgb,34,197,94)/0.5)] transition-all duration-200 ease-out hover:-translate-y-px hover:brightness-110 hover:shadow-[0_6px_20px_-4px_rgba(var(--color-primary-rgb,34,197,94)/0.55)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              <MaterialIcon name="add" outlined={false} className="text-[1.1rem]" />
              {primaryActionLabel}
            </button>
          )}

          {onCertifySnapshot ? (
            <CertifySnapshotButton
              onClick={onCertifySnapshot}
              isLoading={isCertifyingSnapshot}
              disabled={isCertifySnapshotDisabled}
            />
          ) : null}

          {hasMenuItems && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-(--surface-outline) bg-(--surface-container-low) text-muted transition-colors hover:bg-(--surface-container) hover:text-strong"
                aria-label="More options"
                title="More options"
              >
                <MaterialIcon name="more_horiz" outlined={false} className="text-base" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[200px] overflow-hidden rounded-xl border border-(--surface-outline) bg-(--surface-container-low) shadow-lg">
                  {showCharts !== undefined && onToggleShowCharts !== undefined && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-(--surface-container)">
                      <span className="text-sm text-muted">Show charts</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={showCharts}
                        aria-label="Show charts"
                        onClick={onToggleShowCharts}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${showCharts ? "bg-primary" : "bg-(--surface-bright)"}`}
                      >
                        <span className="sr-only">Show charts</span>
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${showCharts ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                    </div>
                  )}

                  {isConnectedPortfolio && onSync && (
                    <button
                      type="button"
                      onClick={() => { onSync(); setMenuOpen(false); }}
                      disabled={isSyncing}
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-muted hover:bg-(--surface-container) disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <MaterialIcon name={isSyncing ? "hourglass_top" : "sync"} outlined={false} className="text-base text-primary" />
                      {isSyncing ? "Syncing…" : "Sync"}
                    </button>
                  )}

                  {showRemovePortfolio && onRemovePortfolio && (
                    <>
                      <div className="mx-3 border-t border-(--surface-outline)" />
                      <button
                        type="button"
                        onClick={() => { onRemovePortfolio(); setMenuOpen(false); }}
                        disabled={isRemovingPortfolio}
                        className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-danger hover:bg-danger-soft/30 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <MaterialIcon name={isRemovingPortfolio ? "hourglass_top" : "delete"} outlined={false} className="text-base" />
                        {isRemovingPortfolio ? "Removing…" : "Remove portfolio"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
