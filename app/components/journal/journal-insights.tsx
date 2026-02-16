import { MaterialIcon } from "../dashboard/material-icon";

export function JournalInsights() {
  return (
    <div className="flex min-w-75 flex-1 flex-col gap-4 overflow-y-auto pb-4">
      <section className="rounded-2xl bg-card-light p-6 shadow-sm">
        <h3 className="mb-4 self-start text-lg font-bold text-strong">Trade Distribution</h3>

        <div className="relative mx-auto h-48 w-48">
          <div className="h-full w-full rounded-full bg-distribution-ring" />
          <div className="absolute inset-6 rounded-full bg-card-light" />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-strong">142</span>
            <span className="text-xs text-muted">Total Trades</span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-primary" />
              <span className="text-body">Bitcoin</span>
            </div>
            <span className="font-semibold text-strong">45%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-info" />
              <span className="text-body">Ethereum</span>
            </div>
            <span className="font-semibold text-strong">30%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-sidebar-dark" />
              <span className="text-body">Altcoins</span>
            </div>
            <span className="font-semibold text-strong">25%</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary/20 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-strong">Mental State</h3>
          <MaterialIcon name="psychology" className="text-primary" />
        </div>

        <div className="space-y-4">
          {[
            { emoji: "😎", label: "Confident", trades: "24 trades", win: "78% Win", winClass: "text-success" },
            { emoji: "😰", label: "Fearful", trades: "8 trades", win: "32% Win", winClass: "text-danger" },
            { emoji: "🤑", label: "Greed", trades: "12 trades", win: "45% Win", winClass: "text-warning" }
          ].map((state) => (
            <div key={state.label} className="flex items-center justify-between rounded-xl bg-card-light p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{state.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-strong">{state.label}</p>
                  <p className="text-xs text-muted">{state.trades}</p>
                </div>
              </div>
              <span className={`text-sm font-bold ${state.winClass}`}>{state.win}</span>
            </div>
          ))}
        </div>

        <button className="mt-4 w-full rounded-lg border border-sidebar-dark py-2 text-sm font-medium text-sidebar-dark transition-colors hover:bg-sidebar-dark hover:text-inverse">
          View Detailed Analysis
        </button>
      </section>

      <section className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-sidebar-dark p-6 text-center text-inverse shadow-lg">
        <MaterialIcon name="tips_and_updates" className="mb-2 text-4xl text-primary" />
        <h3 className="mb-1 font-bold">Trading Tip</h3>
        <p className="mb-4 text-sm text-subtle">"Cut losses quickly, let winners run."</p>
        <button className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover">
          Read More
        </button>
      </section>
    </div>
  );
}
