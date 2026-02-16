import { MaterialIcon } from "../dashboard/material-icon";

export function PortfolioSummary() {
  return (
    <section className="relative mb-8 flex items-center justify-between overflow-hidden rounded-3xl bg-sidebar-dark p-8 text-inverse shadow-xl">
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-primary to-transparent opacity-15" />

      <div>
        <div className="mb-2 flex items-center gap-3 text-subtle">
          <MaterialIcon name="account_balance_wallet" outlined={false} className="text-lg" />
          <span className="typo-body-xs uppercase tracking-wider">Total Portfolio Value</span>
        </div>
        <div className="flex items-end gap-4">
          <h2 className="text-5xl font-bold tracking-tight">57.00 BTC</h2>
          <div className="mb-2 flex items-center gap-1 rounded-lg bg-primary/15 px-2 py-1 text-primary">
            <MaterialIcon name="arrow_upward" outlined={false} className="text-sm" />
            <span className="typo-body-sm">+57.00 BTC (All time)</span>
          </div>
        </div>
        <p className="mt-2 text-sm text-subtle">Your assets are growing steadily.</p>
      </div>

      <div className="hidden items-center gap-8 lg:flex">
        <div className="text-right">
          <p className="mb-1 text-xs uppercase text-subtle">24h Volume</p>
          <p className="text-xl font-semibold">$22,345</p>
        </div>
        <div className="h-10 w-px bg-gray-700" />
        <div className="text-right">
          <p className="mb-1 text-xs uppercase text-subtle">Active Assets</p>
          <p className="text-xl font-semibold">12</p>
        </div>
      </div>
    </section>
  );
}
