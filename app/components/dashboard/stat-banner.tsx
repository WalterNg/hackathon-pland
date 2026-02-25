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
      <div className="text-subtle typo-body-xs mb-1 flex items-center gap-3 uppercase tracking-wider">
        <MaterialIcon name={icon} className="text-sm" />
        {title}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <h2 className="typo-metric text-inverse">{value}</h2>
          <div className="text-subtle typo-caption mt-1">{secondary}</div>
        </div>
        <span className={`typo-caption flex items-center gap-1 rounded-full px-3 py-1 font-bold ${isPositive ? "bg-mint-light text-success" : "bg-danger-soft text-danger"}`}>
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
    <div className="text-inverse relative flex min-h-40 flex-col items-start gap-6 overflow-hidden rounded-2xl bg-sidebar-dark p-5 shadow-lg sm:p-6 md:flex-row md:items-center md:gap-0 lg:p-8">
      <div className="flex h-full w-full flex-1 flex-col justify-center border-b border-gray-700/50 pb-5 md:w-auto md:border-b-0 md:border-r md:pb-0 md:pr-12">
        <BannerBlock
          title="Portfolio Value"
          icon="bar_chart"
          value={formatBtcValue(totalValueBtc, 6)}
          secondary={usdFormatter.format(totalValueUsd)}
          changePercent={allTimeProfitPercent}
        />
      </div>
      <div className="flex h-full w-full flex-1 flex-col justify-center md:w-auto md:pl-12">
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
