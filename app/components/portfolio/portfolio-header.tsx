import { MaterialIcon } from "../dashboard/material-icon";

export function PortfolioHeader() {
  return (
    <header className="flex h-20 shrink-0 items-center justify-between px-8">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-strong">My Portfolio</h1>
        <span className="text-subtle">/</span>
        <span className="typo-body-sm text-muted">gedgd</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-1.5 shadow-sm">
          <span className="typo-body-sm text-muted">Show charts</span>
          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary">
            <span className="sr-only">Enable charts</span>
            <span className="inline-block h-4 w-4 translate-x-6 transform rounded-full bg-white transition" />
          </button>
        </div>

        <button className="text-on-primary typo-body-sm flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-semibold shadow-md shadow-primary/30 transition-colors hover:bg-primary-hover">
          <MaterialIcon name="add" outlined={false} className="text-sm" />
          Add Transaction
        </button>

        <button className="rounded-xl border border-gray-100 bg-white p-2 shadow-sm transition-colors hover:bg-gray-50">
          <MaterialIcon name="download" outlined={false} className="text-muted" />
        </button>

        <button className="rounded-xl border border-gray-100 bg-white p-2 shadow-sm transition-colors hover:bg-gray-50">
          <MaterialIcon name="more_horiz" outlined={false} className="text-muted" />
        </button>
      </div>
    </header>
  );
}
