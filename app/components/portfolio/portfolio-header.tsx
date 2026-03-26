import { MaterialIcon } from "../dashboard/material-icon";

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
  onToggleShowCharts
}: PortfolioHeaderProps) {
  const isReadOnlyStatus = isPrimaryActionDisabled && primaryActionLabel === "Read-only";

  return (
    <section className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 px-1 py-2">
          <span className="typo-body-sm text-muted">Show charts</span>
          <button
            type="button"
            role="switch"
            aria-checked={showCharts}
            aria-label="Show charts"
            onClick={onToggleShowCharts}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showCharts ? "bg-primary" : "bg-(--surface-bright)"}`}
          >
            <span className="sr-only">Show charts</span>
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${showCharts ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
        </div>

        {isReadOnlyStatus ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-(--surface-outline) bg-(--surface-container-low) px-2.5 py-1.5 text-[0.68rem] font-semibold tracking-[0.12em] text-muted">
            <MaterialIcon name="lock" outlined={false} className="text-[0.78rem]" />
            {primaryActionLabel}
          </span>
        ) : (
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={isPrimaryActionDisabled}
            className="ui-button-primary flex items-center gap-1.5 px-4! py-2.5! text-[0.78rem]! normal-case tracking-normal! disabled:cursor-not-allowed disabled:opacity-60"
            style={{ textTransform: "none", letterSpacing: "normal" }}
          >
            <MaterialIcon name="add" outlined={false} className="text-[0.95rem]" />
            {primaryActionLabel}
          </button>
        )}

        {showRemovePortfolio && onRemovePortfolio ? (
          <button
            type="button"
            onClick={onRemovePortfolio}
            disabled={isRemovingPortfolio}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-danger-soft text-danger transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={isRemovingPortfolio ? "Removing portfolio" : "Remove portfolio"}
            title={isRemovingPortfolio ? "Removing portfolio" : "Remove portfolio"}
          >
            <MaterialIcon name={isRemovingPortfolio ? "hourglass_top" : "delete"} outlined={false} className="text-base" />
          </button>
        ) : null}
      </div>
    </section>
  );
}
