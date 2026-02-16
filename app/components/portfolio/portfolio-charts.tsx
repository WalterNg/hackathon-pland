import { MaterialIcon } from "../dashboard/material-icon";

export function PortfolioCharts() {
  return (
    <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <article className="rounded-2xl border border-gray-100 bg-card-light p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-bold text-strong">
            History
            <MaterialIcon name="info" outlined={false} className="text-sm text-gray-300" />
          </h3>
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button className="rounded bg-white px-2 py-1 text-xs font-medium text-strong shadow-sm">24h</button>
            <button className="px-2 py-1 text-xs font-medium text-muted">7d</button>
            <button className="px-2 py-1 text-xs font-medium text-muted">30d</button>
            <button className="px-2 py-1 text-xs font-medium text-muted">All</button>
          </div>
        </div>

        <div className="relative flex h-48 items-end justify-between px-2">
          <div className="absolute inset-0 flex items-end justify-around px-4 pb-6 pt-10">
            <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <path d="M0 48 L20 48 L40 48 L60 48 L70 48 L75 10 L80 48 L100 48" fill="none" stroke="#EF4444" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <defs>
                <linearGradient id="gradientRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 48 L20 48 L40 48 L60 48 L70 48 L75 10 L80 48 L100 48 V50 H0 Z" fill="url(#gradientRed)" opacity="0.3" />
            </svg>
          </div>

          <div className="absolute right-0 top-0 bottom-6 flex w-12 flex-col justify-between bg-white/80 text-right font-mono text-[10px] text-subtle backdrop-blur-sm">
            <span>57.05</span>
            <span>57.04</span>
            <span>57.03</span>
            <span>57.02</span>
            <span>57.01</span>
          </div>
        </div>

        <div className="mt-2 flex justify-between px-2 text-[10px] text-subtle">
          <span>1:00 AM</span>
          <span>1:20 AM</span>
          <span>1:40 AM</span>
          <span>2:00 AM</span>
          <span>2:20 AM</span>
        </div>
      </article>

      <article className="rounded-2xl border border-gray-100 bg-card-light p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-bold text-strong">
            Performance
            <MaterialIcon name="info" outlined={false} className="text-sm text-gray-300" />
          </h3>
        </div>

        <div className="mb-4 flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-muted">All-time profit</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-300" />
            <span className="text-muted">BTC trend</span>
          </div>
        </div>

        <div className="relative h-48 overflow-hidden rounded-lg border border-blue-100 bg-blue-50/50">
          <div className="relative h-full w-full">
            <div className="absolute left-0 right-0 top-4 h-px bg-orange-300" />
            <div className="absolute bottom-4 left-0 right-0 h-0.5 bg-blue-600" />
            <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-between py-2 text-right text-[10px] text-subtle">
              <span>0%</span>
              <span>-10%</span>
              <span>-30%</span>
              <span>-50%</span>
              <span>-60%</span>
            </div>
          </div>
        </div>

        <div className="mt-2 flex justify-between px-2 text-[10px] text-subtle">
          <span>08:00 AM</span>
          <span>12:00 PM</span>
          <span>04:00 PM</span>
          <span>08:00 PM</span>
          <span>12:00 AM</span>
        </div>
      </article>

      <article className="flex flex-col rounded-2xl border border-gray-100 bg-card-light p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-bold text-strong">Allocation</h3>
        </div>

        <div className="flex flex-1 items-center justify-center gap-8">
          <div className="relative h-32 w-32">
            <svg className="h-full w-full -rotate-90 transform">
              <circle cx="64" cy="64" r="56" fill="none" stroke="#E5E7EB" strokeWidth="12" />
              <circle cx="64" cy="64" r="56" fill="none" stroke="#3B82F6" strokeWidth="12" strokeLinecap="round" strokeDasharray="351.86" strokeDashoffset="0" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <MaterialIcon name="pie_chart" outlined={false} className="text-4xl text-gray-300" />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              <span className="typo-body-sm font-semibold text-strong">Bitcoin</span>
            </div>
            <span className="ml-5 block text-xs text-muted">100.00%</span>
          </div>
        </div>
      </article>
    </section>
  );
}
