import { MaterialIcon } from "./material-icon";
import { PortfolioChart } from "./portfolio-chart";

const currentStats = [
  { label: "Income", value: "$2,500", progress: "75%", colorClass: "bg-indigo-900" },
  { label: "Spends", value: "$943", progress: "35%", colorClass: "bg-teal-500" },
  { label: "Invest", value: "$7469", progress: "60%", colorClass: "bg-gray-300" },
  { label: "Installments", value: "$16", progress: "5%", colorClass: "bg-gray-200" }
];

export function PortfolioSection() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-7">
      <div className="rounded-2xl bg-card-light p-6 shadow-soft md:col-span-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="typo-section text-strong">Portfolio Stats</h3>
          <div className="flex gap-3">
            <button className="typo-body-xs text-body flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 transition hover:bg-gray-50">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> Bitcoin
              <MaterialIcon name="expand_more" className="text-sm" />
            </button>
            <button className="typo-body-xs text-body flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 transition hover:bg-gray-50">
              Weekly
              <MaterialIcon name="expand_more" className="text-sm" />
            </button>
          </div>
        </div>

        <div className="chart-container relative mt-4">
          <div className="text-inverse pointer-events-none absolute left-[35%] top-[20%] z-10 min-w-35 -translate-x-1/2 transform rounded-lg bg-sidebar-dark p-3 shadow-xl">
            <div className="text-subtle typo-caption mb-1">Tuesday, Oct 8, 2024</div>
            <div className="typo-body-sm flex items-center gap-1.5 font-bold">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Value $4,251
            </div>
            <div className="absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 transform bg-sidebar-dark" />
          </div>
          <PortfolioChart />
        </div>

        <div className="text-subtle typo-caption mt-2 flex justify-between px-4 uppercase">
          <span>Oct 1</span>
          <span>Oct 2</span>
          <span>Oct 3</span>
          <span className="text-strong font-bold">Oct 4</span>
          <span>Oct 5</span>
          <span>Oct 6</span>
          <span>Oct 7</span>
        </div>
      </div>

      <div className="flex flex-col gap-6 md:col-span-2">
        <div className="flex flex-1 flex-col justify-center rounded-2xl bg-card-light p-6 shadow-soft">
          <h3 className="typo-body-xs text-strong mb-5 uppercase tracking-wide font-bold">Current Stats</h3>
          <div className="space-y-5">
            {currentStats.map((item) => (
              <div key={item.label}>
                <div className="typo-body-xs mb-1.5 flex justify-between">
                  <span className="text-muted flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-sm ${item.colorClass}`} />
                    {item.label}
                  </span>
                  <span className="text-strong font-bold">{item.value}</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-1 rounded-full ${item.colorClass}`} style={{ width: item.progress }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="group flex h-24 cursor-pointer items-center justify-between rounded-2xl bg-mint-card p-5 shadow-soft">
          <div className="pr-2">
            <p className="typo-body-sm text-body leading-snug">
              Learn To Invest Daily,
              <br />
              Weekly, Or Monthly
            </p>
          </div>
          <div className="text-accent flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm transition-transform group-hover:scale-105">
            <MaterialIcon name="chevron_right" className="text-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
