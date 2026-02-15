import { MaterialIcon } from "./material-icon";

function BannerBlock({ title, icon, value }: { title: string; icon: string; value: string }) {
  return (
    <div className="flex h-full flex-1 flex-col justify-center">
      <div className="mb-1 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        <MaterialIcon name={icon} className="text-sm" />
        {title}
      </div>
      <div className="flex items-end justify-between">
        <h2 className="text-4xl font-bold tracking-tight">{value}</h2>
        <span className="flex items-center gap-1 rounded-full bg-mint-light px-3 py-1 text-[10px] font-bold text-green-800">
          <MaterialIcon name="arrow_drop_up" className="text-[10px]" />
          1.37%
        </span>
      </div>
    </div>
  );
}

export function StatBanner() {
  return (
    <div className="relative flex h-40 flex-col items-center overflow-hidden rounded-2xl bg-sidebar-dark p-8 text-white shadow-lg md:flex-row">
      <div className="flex h-full flex-1 flex-col justify-center border-r border-gray-700/50 md:pr-12">
        <BannerBlock title="Portfolio Value" icon="bar_chart" value="$20,000" />
      </div>
      <div className="flex h-full flex-1 flex-col justify-center md:pl-12">
        <BannerBlock title="Volume (24H)" icon="tune" value="$22,345" />
      </div>
    </div>
  );
}
