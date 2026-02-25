"use client";

import { useMemo, useState } from "react";
import type { PortfolioAssetRow, PortfolioChartPoint } from "@/app/lib/portfolio-types";
import { MaterialIcon } from "./material-icon";
import { PortfolioChart } from "./portfolio-chart";

type PortfolioSectionProps = {
  chart: PortfolioChartPoint[];
  assets: PortfolioAssetRow[];
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric"
});

const timeframes = ["24h", "7d", "30d", "All"] as const;
type Timeframe = (typeof timeframes)[number];

const statColors = ["bg-primary", "bg-accent", "bg-gray-400", "bg-gray-300"];

export function PortfolioSection({ chart, assets }: PortfolioSectionProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("7d");

  const totalValue = assets.reduce((sum, asset) => sum + asset.valueUsd, 0);
  const currentStats = assets.slice(0, 4).map((asset, index) => ({
    label: asset.symbol.replace("USDT", ""),
    value: usdFormatter.format(asset.valueUsd),
    progress: `${Math.max(0, Math.min(100, asset.allocationPercent)).toFixed(0)}%`,
    colorClass: statColors[index] ?? "bg-gray-300"
  }));

  const filteredChart = useMemo(() => {
    if (chart.length === 0) {
      return [];
    }

    if (timeframe === "All") {
      return chart;
    }

    if (timeframe === "24h") {
      return chart.slice(-2);
    }

    if (timeframe === "7d") {
      return chart.slice(-7);
    }

    return chart.slice(-30);
  }, [chart, timeframe]);

  const latestPoint = filteredChart[filteredChart.length - 1] ?? chart[chart.length - 1];
  const chartLabels = filteredChart.slice(0, 7).map((point) => {
    const date = new Date(point.time);
    return Number.isNaN(date.getTime()) ? point.time : dateFormatter.format(date);
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-7 md:gap-6">
      <div className="rounded-2xl bg-card-light p-5 shadow-soft sm:p-6 md:col-span-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="typo-section text-strong">Portfolio Stats</h3>
          <div className="flex gap-3">
            <button className="typo-body-xs text-body flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 transition hover:bg-gray-50">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> Bitcoin
              <MaterialIcon name="expand_more" className="text-sm" />
            </button>
            <div className="flex rounded-lg border border-gray-200 p-1">
              {timeframes.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTimeframe(option)}
                  className={
                    option === timeframe
                      ? "typo-body-xs rounded-md bg-gray-100 px-2 py-1 font-semibold text-strong"
                      : "typo-body-xs rounded-md px-2 py-1 text-muted transition hover:text-body"
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="chart-container relative mt-4">
          <div className="text-inverse pointer-events-none absolute left-[35%] top-[20%] z-10 min-w-35 -translate-x-1/2 transform rounded-lg bg-sidebar-dark p-3 shadow-xl">
            <div className="text-subtle typo-caption mb-1">Latest Snapshot</div>
            <div className="typo-body-sm flex items-center gap-1.5 font-bold">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Value {usdFormatter.format(latestPoint?.totalValueUsd ?? totalValue)}
            </div>
            <div className="absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 transform bg-sidebar-dark" />
          </div>
          <PortfolioChart chart={filteredChart} />
        </div>

        <div className="text-subtle typo-caption mt-2 flex justify-between px-4 uppercase">
          {chartLabels.map((label, index) => (
            <span key={`${label}-${index}`} className={index === chartLabels.length - 1 ? "text-strong font-bold" : ""}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 md:col-span-2 md:gap-6">
        <div className="flex flex-1 flex-col justify-center rounded-2xl bg-card-light p-5 shadow-soft sm:p-6">
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
