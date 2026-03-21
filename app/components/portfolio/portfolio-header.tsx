import { MaterialIcon } from "../dashboard/material-icon";

type PortfolioHeaderProps = {
  portfolioName: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  onAnalyzeWithAI: () => void;
  isAnalyzeDisabled?: boolean;
  isAnalyzing?: boolean;
  onRemovePortfolio?: () => void;
  showRemovePortfolio?: boolean;
  isRemovingPortfolio?: boolean;
  showCharts: boolean;
  onToggleShowCharts: () => void;
};

export function PortfolioHeader({
  portfolioName,
  primaryActionLabel,
  onPrimaryAction,
  onAnalyzeWithAI,
  isAnalyzeDisabled = false,
  isAnalyzing = false,
  onRemovePortfolio,
  showRemovePortfolio = false,
  isRemovingPortfolio = false,
  showCharts,
  onToggleShowCharts,
}: PortfolioHeaderProps) {
  return (
    <section className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h1 className="typo-h1 text-strong">{portfolioName}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-1.5 shadow-sm">
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

        <button
          type="button"
          onClick={onAnalyzeWithAI}
          disabled={isAnalyzeDisabled || isAnalyzing}
          className="typo-body-sm inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2 font-semibold text-strong shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MaterialIcon name={isAnalyzing ? "hourglass_top" : "auto_awesome"} outlined={false} className="text-sm" />
          Analyze with AI
        </button>

        <button
          type="button"
          onClick={onPrimaryAction}
          className="ui-button-primary flex items-center gap-1.5 px-4! py-2.5! text-[0.78rem]! normal-case tracking-normal!"
          style={{ textTransform: "none", letterSpacing: "normal" }}
        >
          <MaterialIcon name="add" outlined={false} className="text-[0.95rem]" />
          {primaryActionLabel}
        </button>

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
