"use client";

import { useMemo, useState } from "react";
import type { PortfolioAssetRow, PortfolioChartPoint } from "@/app/lib/portfolio-types";

type PortfolioChartsProps = {
  chart: PortfolioChartPoint[];
  assets: PortfolioAssetRow[];
  allTimeProfitPercent: number;
};

const timeframes = ["24h", "7d", "30d", "All"] as const;
type Timeframe = (typeof timeframes)[number];

const chartLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric"
});

const THEME_COLORS = {
  primary: "var(--color-primary)",
  danger: "var(--text-danger)",
  info: "var(--text-info)"
} as const;

const ALLOCATION_COLORS = [
  "var(--color-primary)",
  "var(--text-info)",
  "var(--text-accent)",
  "var(--text-warning)",
  "var(--text-danger)",
  "var(--text-positive)",
  "var(--color-sidebar-dark)"
] as const;

const CHART_BASELINE = 50;
const CHART_HEIGHT = 35;
const TICK_COUNT = 3;
const LINE_STROKE_WIDTH = 2;
const GRADIENT_TOP_OPACITY = 0.22;

type ValueRange = {
  min: number;
  max: number;
  spread: number;
};

function getValueRange(values: number[]): ValueRange {
  if (values.length === 0) {
    return { min: 0, max: 1, spread: 1 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, spread: Math.max(max - min, 1) };
}

function chartValuesToPath(values: number[], range: ValueRange): string {
  if (values.length === 0) {
    return `M0 ${CHART_BASELINE} L100 ${CHART_BASELINE}`;
  }

  if (values.length === 1) {
    const y = CHART_BASELINE - ((values[0] - range.min) / range.spread) * CHART_HEIGHT;
    return `M0 ${y.toFixed(2)} L100 ${y.toFixed(2)}`;
  }

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const normalizedValue = (value - range.min) / range.spread;
      const y = CHART_BASELINE - normalizedValue * CHART_HEIGHT;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function chartAreaPath(path: string): string {
  return `${path} V${CHART_BASELINE} H0 Z`;
}

function createTicks(min: number, max: number, count = TICK_COUNT): number[] {
  if (count <= 1) {
    return [max];
  }

  const spread = max - min;
  if (spread === 0) {
    return Array.from({ length: count }, () => max);
  }

  return Array.from({ length: count }, (_, index) => {
    const ratio = 1 - index / (count - 1);
    return min + spread * ratio;
  });
}

function trendColorByDirection(start: number, end: number): string {
  return end >= start ? THEME_COLORS.primary : THEME_COLORS.danger;
}

function formatBtcTick(value: number): string {
  return `${value.toFixed(4)} BTC`;
}

function formatPercentTick(value: number): string {
  return `${value.toFixed(2)}%`;
}

function performanceValues(points: PortfolioChartPoint[]): number[] {
  if (points.length === 0) {
    return [0];
  }

  const base = points[0]?.totalValueUsd || 1;
  return points.map((point) => ((point.totalValueUsd - base) / base) * 100);
}

function allocationLabel(symbol: string): string {
  const upper = symbol.toUpperCase();

  if (upper.endsWith("USDT") || upper.endsWith("BUSD")) {
    return upper.slice(0, -4);
  }

  if (upper.endsWith("BTC") && upper.length > 3) {
    return upper.slice(0, -3);
  }

  return upper;
}

export function PortfolioCharts({ chart, assets, allTimeProfitPercent }: PortfolioChartsProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("7d");

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

  const btcPriceUsd = useMemo(() => {
    const btcAsset = assets.find((asset) => asset.symbol === "BTCUSDT");
    return btcAsset?.priceUsd ?? 0;
  }, [assets]);

  const historyValuesBtc = useMemo(
    () => filteredChart.map((point) => (btcPriceUsd > 0 ? point.totalValueUsd / btcPriceUsd : 0)),
    [filteredChart, btcPriceUsd]
  );
  const historyRange = useMemo(() => getValueRange(historyValuesBtc), [historyValuesBtc]);
  const historyPath = useMemo(() => chartValuesToPath(historyValuesBtc, historyRange), [historyValuesBtc, historyRange]);
  const historyTicks = useMemo(() => createTicks(historyRange.min, historyRange.max), [historyRange]);
  const historyColor = trendColorByDirection(historyValuesBtc[0] ?? 0, historyValuesBtc[historyValuesBtc.length - 1] ?? 0);

  const performance = performanceValues(filteredChart);
  const allTimeProfitDisplayPercent = useMemo(() => {
    const performanceRange = getValueRange(performance);
    const capPadding = Math.max(performanceRange.spread * 0.6, 5);
    const minCap = performanceRange.min - capPadding;
    const maxCap = performanceRange.max + capPadding;

    return Math.min(maxCap, Math.max(minCap, allTimeProfitPercent));
  }, [performance, allTimeProfitPercent]);
  const allTimeProfitSeries = (performance.length ? performance : [0]).map(() => allTimeProfitDisplayPercent);
  const performanceRange = getValueRange([...performance, ...allTimeProfitSeries]);
  const performanceTicks = createTicks(performanceRange.min, performanceRange.max);
  const btcPerformancePath = chartValuesToPath(performance, performanceRange);
  const allTimeProfitPath = chartValuesToPath(allTimeProfitSeries, performanceRange);
  const btcPerformanceColor = trendColorByDirection(performance[0] ?? 0, performance[performance.length - 1] ?? 0);
  const allTimeProfitColor = THEME_COLORS.info;

  const historyArea = chartAreaPath(historyPath);
  const btcPerformanceArea = chartAreaPath(btcPerformancePath);
  const allTimeProfitArea = chartAreaPath(allTimeProfitPath);

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const allocationSegments = useMemo(() => {
    const raw = assets
      .map((asset) => {
        const value = Number(asset.allocationPercent);
        const clampedValue = Number.isFinite(value) ? Math.max(0, value) : 0;

        return {
          symbol: asset.symbol,
          label: allocationLabel(asset.symbol),
          allocationPercent: clampedValue
        };
      })
      .filter((asset) => asset.allocationPercent > 0);

    const total = raw.reduce((sum, asset) => sum + asset.allocationPercent, 0);
    if (total <= 0) {
      return [];
    }

    const sorted = [...raw].sort((left, right) => {
      if (right.allocationPercent !== left.allocationPercent) {
        return right.allocationPercent - left.allocationPercent;
      }

      return left.symbol.localeCompare(right.symbol);
    });

    return sorted.map((asset) => ({
      ...asset,
      normalizedPercent: (asset.allocationPercent / total) * 100
    }));
  }, [assets]);

  const allocationRings = useMemo(() => {
    let cumulativeOffset = 0;

    return allocationSegments.map((segment, index) => {
      const dash = (circumference * segment.normalizedPercent) / 100;
      const ring = {
        ...segment,
        color: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
        dash,
        gap: Math.max(circumference - dash, 0),
        offset: -cumulativeOffset
      };

      cumulativeOffset += dash;
      return ring;
    });
  }, [allocationSegments, circumference]);

  const chartLabels = filteredChart.slice(0, 5).map((point) => {
    const date = new Date(point.time);
    return Number.isNaN(date.getTime()) ? point.time : chartLabelFormatter.format(date);
  });

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 md:gap-6 lg:mb-8 lg:grid-cols-3">
      <article className="panel-base p-5 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="section-title">History</h3>
          <div className="panel-high flex rounded-xl p-1">
            {timeframes.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTimeframe(option)}
                className={
                  option === timeframe
                    ? "rounded-lg bg-(--surface-bright) px-3 py-1 text-[0.58rem] font-medium text-strong"
                    : "px-3 py-1 text-[0.58rem] font-medium text-muted"
                }
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="relative h-48">
          <div className="absolute inset-0 flex items-end justify-around pl-2 pr-16 pb-6 pt-10">
            <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <defs>
                <linearGradient id="history-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={historyColor} stopOpacity={GRADIENT_TOP_OPACITY} />
                  <stop offset="100%" stopColor={historyColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={historyPath}
                fill="none"
                style={{ stroke: historyColor }}
                strokeWidth={LINE_STROKE_WIDTH}
                vectorEffect="non-scaling-stroke"
              />
              <path d={historyArea} fill="url(#history-gradient)" />
            </svg>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-14 flex-col justify-between pb-6 pt-10 text-right text-[10px] text-subtle">
            {historyTicks.map((tick, index) => (
              <span key={`history-tick-${index}`}>{formatBtcTick(tick)}</span>
            ))}
          </div>
        </div>

        <div className="mt-2 flex justify-between px-2 text-[10px] text-subtle">
          {chartLabels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>
      </article>

      <article className="panel-base p-5 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="section-title">Performance</h3>
        </div>

        <div className="mb-4 flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: allTimeProfitColor }} />
            <span className="text-muted">All-time profit</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: btcPerformanceColor }} />
            <span className="text-muted">BTC trend</span>
          </div>
        </div>

        <div className="relative h-48 overflow-hidden rounded-xl bg-(--surface-container-low)">
          <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-full w-full pr-14">
            <defs>
              <linearGradient id="btc-performance-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={btcPerformanceColor} stopOpacity={GRADIENT_TOP_OPACITY} />
                <stop offset="100%" stopColor={btcPerformanceColor} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="alltime-profit-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={allTimeProfitColor} stopOpacity={GRADIENT_TOP_OPACITY} />
                <stop offset="100%" stopColor={allTimeProfitColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={btcPerformanceArea} fill="url(#btc-performance-gradient)" />
            <path d={allTimeProfitArea} fill="url(#alltime-profit-gradient)" />
            <path
              d={allTimeProfitPath}
              fill="none"
              style={{ stroke: allTimeProfitColor }}
              strokeWidth={LINE_STROKE_WIDTH}
              strokeDasharray="4 2"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={btcPerformancePath}
              fill="none"
              style={{ stroke: btcPerformanceColor }}
              strokeWidth={LINE_STROKE_WIDTH}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-14 flex-col justify-between pb-6 pt-10 text-right text-[10px] text-subtle">
            {performanceTicks.map((tick, index) => (
              <span key={`perf-tick-${index}`}>{formatPercentTick(tick)}</span>
            ))}
          </div>
        </div>

        <div className="mt-2 flex justify-between px-2 text-[10px] text-subtle">
          {chartLabels.map((label, index) => (
            <span key={`perf-${label}-${index}`}>{label}</span>
          ))}
        </div>
      </article>

      <article className="panel-base flex flex-col p-5 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="section-title">Allocation</h3>
        </div>

        <div className="flex flex-1 items-center justify-center gap-8">
          <div className="relative h-40 w-40 text-(--surface-container-highest)">
            <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90 transform">
              <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth="16" />

              {allocationRings.map((segment) => (
                <circle
                  key={segment.symbol}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  style={{ stroke: segment.color }}
                  strokeWidth="16"
                  strokeLinecap="butt"
                  strokeDasharray={`${segment.dash} ${segment.gap}`}
                  strokeDashoffset={segment.offset}
                />
              ))}
            </svg>
          </div>

          <div className="max-h-40 flex-1 space-y-2 overflow-y-auto pr-1">
            {allocationRings.length === 0 && <div className="text-xs text-muted">No assets available</div>}

            {allocationRings.map((segment) => (
              <div key={`legend-${segment.symbol}`} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                  <span className="truncate text-xs font-semibold text-strong">{segment.label}</span>
                </div>
                <span className="text-xs text-muted">{segment.normalizedPercent.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}
