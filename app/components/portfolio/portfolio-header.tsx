import { MaterialIcon } from "../dashboard/material-icon";

type PortfolioHeaderProps = {
  portfolioName: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  showCharts: boolean;
  onToggleShowCharts: () => void;
};

export function PortfolioHeader({
  portfolioName,
  primaryActionLabel,
  onPrimaryAction,
  showCharts,
  onToggleShowCharts
}: PortfolioHeaderProps) {
  return (
    <header className="h-20 shrink-0 px-4 sm:h-24 sm:px-6 lg:px-8">
      <div className="content-shell flex h-full items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-strong">My Portfolio</h1>
          <span className="text-subtle">/</span>
          <span className="typo-body-sm text-muted">{portfolioName}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-1.5 shadow-sm">
            <span className="typo-body-sm text-muted">Show charts</span>
            <button
              type="button"
              role="switch"
              aria-checked={showCharts}
              aria-label="Show charts"
              onClick={onToggleShowCharts}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showCharts ? "bg-primary" : "bg-gray-300"}`}
            >
              <span className="sr-only">Show charts</span>
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${showCharts ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={onPrimaryAction}
            className="text-on-primary typo-body-sm flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-semibold shadow-md shadow-primary/30 transition-colors hover:bg-primary-hover"
          >
            <MaterialIcon name="add" outlined={false} className="text-sm" />
            {primaryActionLabel}
          </button>

          <button className="rounded-xl border border-gray-100 bg-white p-2 shadow-sm transition-colors hover:bg-gray-50">
            <MaterialIcon name="download" outlined={false} className="text-muted" />
          </button>
        </div>
      </div>
    </header>
  );
}
