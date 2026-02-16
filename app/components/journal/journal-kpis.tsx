import { MaterialIcon } from "../dashboard/material-icon";

const kpis = [
  { title: "Win Rate", value: "72%", note: "+2.4%", progress: 72, icon: "emoji_events" },
  { title: "Profit/Loss", value: "+$3,450", note: "+12.5%", subtitle: "Net profit this month", icon: "attach_money" },
  { title: "Avg. R:R", value: "1:2.4", note: "Optimal", subtitle: "Risk to Reward Ratio", icon: "analytics" }
];

export function JournalKpis() {
  return (
    <div className="grid shrink-0 grid-cols-3 gap-4">
      {kpis.map((kpi) => (
        <article key={kpi.title} className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-sidebar-dark p-5 text-inverse shadow-lg">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 transform opacity-5 transition-transform group-hover:scale-110">
            <MaterialIcon name={kpi.icon} className="text-9xl" />
          </div>

          <div className="z-10 flex items-start justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle">{kpi.title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs ${kpi.note === "Optimal" ? "bg-info-soft text-info" : "bg-success-soft text-success"}`}>
              {kpi.note}
            </span>
          </div>

          <div className="z-10 mt-4">
            <span className="text-3xl font-bold">{kpi.value}</span>
            {kpi.progress ? (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                <div className="h-full rounded-full bg-primary" style={{ width: `${kpi.progress}%` }} />
              </div>
            ) : (
              <p className="mt-2 text-xs text-subtle">{kpi.subtitle}</p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
