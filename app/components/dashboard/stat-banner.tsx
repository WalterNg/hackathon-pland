import { MaterialIcon } from "./material-icon";

type BannerBlockProps = {
  title: string;
  icon: string;
  value: string;
  secondary: string;
  changePercent: number;
};

type StatBannerProps = {
  totalValueBtc: number | null;
  totalValueUsd: number;
  btcPriceUsd: number | null;
  totalVolume24hUsd: number;
  allTimeProfitPercent: number;
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

function BannerBlock({ title, icon, value, secondary, changePercent }: BannerBlockProps) {
  const isPositive = changePercent >= 0;

  return (
    <div className="flex h-full flex-1 flex-col justify-center">
      <div className="eyebrow mb-3 flex items-center gap-3 text-subtle">
        <MaterialIcon name={icon} className="text-sm" />
        {title}
      </div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="typo-metric text-inverse">{value}</h2>
          <div className="text-subtle typo-caption mt-1">{secondary}</div>
        </div>
        <span className={`status-pill ${isPositive ? "status-pill-positive" : "status-pill-negative"}`}>
          <MaterialIcon name={isPositive ? "arrow_drop_up" : "arrow_drop_down"} className="text-[10px]" />
          {Math.abs(changePercent).toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function formatBtcValue(value: number | null, fractionDigits = 6) {
  if (value === null) {
    return "N/A";
  }

  return `${value.toFixed(fractionDigits)} BTC`;
}

export function StatBanner({ totalValueBtc, totalValueUsd, btcPriceUsd, totalVolume24hUsd, allTimeProfitPercent }: StatBannerProps) {
  const totalVolume24hBtc = btcPriceUsd && btcPriceUsd > 0 ? totalVolume24hUsd / btcPriceUsd : null;

  return (
    <div className="text-inverse relative flex min-h-40 flex-col items-start gap-8 overflow-hidden rounded-[1.5rem] bg-sidebar-dark p-6 shadow-[0_24px_60px_rgba(0,0,0,0.34)] sm:p-7 md:flex-row md:items-center lg:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(60,227,106,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(136,180,255,0.12),transparent_24%)]" />
      <div className="relative flex h-full w-full flex-1 flex-col justify-center md:w-auto md:pr-12">
        <BannerBlock
          title="Portfolio Value"
          icon="bar_chart"
          value={formatBtcValue(totalValueBtc, 6)}
          secondary={usdFormatter.format(totalValueUsd)}
          changePercent={allTimeProfitPercent}
        />
      </div>
      <div className="relative h-px w-full bg-white/6 md:h-28 md:w-px" />
      <div className="relative flex h-full w-full flex-1 flex-col justify-center md:w-auto md:pl-12">
        <BannerBlock
          title="Volume (24H)"
          icon="tune"
          value={formatBtcValue(totalVolume24hBtc, 6)}
          secondary={usdFormatter.format(totalVolume24hUsd)}
          changePercent={allTimeProfitPercent / 2}
        />
      </div>
    </div>
  );
}
