"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import type { PortfolioAssetRow, PortfolioChartPoint, PortfolioForecast } from "@/app/lib/portfolio-types";
import { MaterialIcon } from "../dashboard/material-icon";
import { PortfolioForecastDialog } from "./portfolio-forecast-dialog";

type PortfolioChartsProps = {
  chart: PortfolioChartPoint[];
  assets: PortfolioAssetRow[];
  forecast: PortfolioForecast | null;
  forecastError: string | null;
  isForecastLoading?: boolean;
  onRefreshForecast: () => void;
  isLoading?: boolean;
};

const timeframes = ["24h", "7d", "30d", "90d", "All"] as const;
type Timeframe = (typeof timeframes)[number];

const CHART_BASELINE = 50;
const CHART_HEIGHT = 35;
const TICK_COUNT = 5;
const LINE_STROKE_WIDTH = 1.5;
const GRADIENT_TOP_OPACITY = 0.18;

const THEME_COLORS = {
  primary: "var(--color-primary)",
  danger: "var(--text-danger)",
} as const;

const ALLOCATION_COLORS = [
  "var(--color-primary)",
  "var(--text-info)",
  "var(--text-accent)",
  "var(--text-warning)",
  "var(--text-danger)",
  "var(--text-positive)",
  "var(--color-sidebar-dark)",
] as const;

type ValueRange = { min: number; max: number; spread: number };

function getValueRange(values: number[]): ValueRange {
  if (values.length === 0) return { min: 0, max: 1, spread: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, spread: Math.max(max - min, 1) };
}

/**
 * Stable range for chart rendering — avoids Y-axis rescaling on every live tick.
 * zeroBaseline=true → "All" timeframe: pin to $0 so long-term growth shape is preserved.
 * zeroBaseline=false → short timeframes: tight zoom so small moves fill the chart.
 */
function getStableRange(values: number[], zeroBaseline = false): ValueRange {
  if (values.length === 0) return { min: 0, max: 1, spread: 1 };
  const fullMin = Math.min(...values);
  const fullMax = Math.max(...values);
  const dataSpread = Math.max(fullMax - fullMin, 1);
  const pad = Math.max(dataSpread * 0.05, 1);
  const hi = fullMax + pad;
  const lo = Math.max(0, fullMin - pad);
  if (zeroBaseline) return { min: 0, max: hi, spread: hi };
  return { min: lo, max: hi, spread: hi - lo };
}

function chartValuesToPath(values: number[], range: ValueRange): string {
  if (values.length === 0) return `M0 ${CHART_BASELINE} L100 ${CHART_BASELINE}`;
  if (values.length === 1) {
    const y = CHART_BASELINE - ((values[0] - range.min) / range.spread) * CHART_HEIGHT;
    return `M0 ${y.toFixed(2)} L100 ${y.toFixed(2)}`;
  }
  return values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = CHART_BASELINE - ((value - range.min) / range.spread) * CHART_HEIGHT;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function chartAreaPath(path: string): string {
  return `${path} V${CHART_BASELINE} H0 Z`;
}

function createTicks(min: number, max: number, count = TICK_COUNT): number[] {
  if (count <= 1) return [max];
  const spread = max - min;
  if (spread === 0) return Array.from({ length: count }, () => max);
  return Array.from({ length: count }, (_, i) => min + spread * (1 - i / (count - 1)));
}

function trendColorByDirection(start: number, end: number): string {
  return end >= start ? THEME_COLORS.primary : THEME_COLORS.danger;
}

const usdAxisFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdTooltipFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdCompactFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatUsdTick(v: number) { return usdAxisFormatter.format(v); }
function formatUsdTooltip(v: number) { return usdTooltipFormatter.format(v); }
function formatUsdCompact(v: number) { return usdCompactFormatter.format(v); }

const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const tooltipTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

const axisLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const axisHourFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatTooltipDate(time: string): { date: string; time: string } {
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return { date: time, time: "" };
  return {
    date: tooltipDateFormatter.format(d).replace(",", "."),
    time: tooltipTimeFormatter.format(d),
  };
}

function formatAxisLabel(time: string, hourMode = false): string {
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return time;
  return hourMode ? axisHourFormatter.format(d) : axisLabelFormatter.format(d);
}

function allocationLabel(symbol: string): string {
  const upper = symbol.toUpperCase();
  if ((upper.endsWith("USDT") || upper.endsWith("BUSD")) && upper.length > 4) return upper.slice(0, -4);
  if (upper.endsWith("BTC") && upper.length > 3) return upper.slice(0, -3);
  return upper;
}

// ── Hover hook ───────────────────────────────────────────────────────────────
type HoverState = {
  fracIndex: number;
  rawSvgX: number;
  tooltipLeftPx: number;
};

function useChartHover(valuesLength: number) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const svg = svgRef.current;
      const container = containerRef.current;
      if (!svg || !container || valuesLength < 2) return;
      const svgRect = svg.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const xRatio = Math.max(0, Math.min(1, (e.clientX - svgRect.left) / svgRect.width));
      const fracIndex = xRatio * (valuesLength - 1);
      const rawSvgX = xRatio * 100;
      const rawLeft = e.clientX - containerRect.left;
      const tooltipLeftPx = Math.max(60, Math.min(containerRect.width - 100, rawLeft));
      setHover({ fracIndex, rawSvgX, tooltipLeftPx });
    },
    [valuesLength],
  );

  const handleMouseLeave = useCallback(() => setHover(null), []);

  return { hover, svgRef, containerRef, handleMouseMove, handleMouseLeave };
}

function interpValue(values: number[], fracIdx: number): number {
  if (values.length === 0) return 0;
  const i0 = Math.max(0, Math.min(Math.floor(fracIdx), values.length - 2));
  const i1 = i0 + 1;
  const t = fracIdx - i0;
  return values[i0] * (1 - t) + values[i1] * t;
}

function interpTime(chart: PortfolioChartPoint[], fracIdx: number): string {
  if (chart.length === 0) return new Date().toISOString();
  const i0 = Math.max(0, Math.min(Math.floor(fracIdx), chart.length - 2));
  const i1 = i0 + 1;
  const t = fracIdx - i0;
  const ms0 = new Date(chart[i0].time).getTime();
  const ms1 = new Date(chart[i1].time).getTime();
  return new Date(ms0 + t * (ms1 - ms0)).toISOString();
}

function svgY(value: number, range: ValueRange): number {
  return CHART_BASELINE - ((value - range.min) / range.spread) * CHART_HEIGHT;
}

const TIMEFRAME_MS: Partial<Record<Timeframe, number>> = {
  "24h": 24 * 3_600_000,
  "7d": 7 * 24 * 3_600_000,
  "30d": 30 * 24 * 3_600_000,
  "90d": 90 * 24 * 3_600_000,
};

// ── Loading states ────────────────────────────────────────────────────────────
function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div className={`${height} relative overflow-hidden rounded-xl bg-(--surface-container-low)`}>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between px-2 py-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-px w-full bg-white opacity-[0.04]" />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <svg className="h-8 w-8 animate-spin text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </svg>
        <span className="text-sm text-muted">Loading…</span>
      </div>
    </div>
  );
}

function RefreshingOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3">
      <svg className="h-8 w-8 animate-spin text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
        <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
      </svg>
      <span className="text-sm text-muted">Updating…</span>
    </div>
  );
}

function ChartEmpty({ height }: { height: string }) {
  return (
    <div className={`${height} flex items-center justify-center`}>
      <span className="text-xs text-muted">No chart data available</span>
    </div>
  );
}

function ChartWrapper({
  isLoading,
  hasData,
  height,
  children,
}: {
  isLoading: boolean;
  hasData: boolean;
  height: string;
  children: React.ReactNode;
}) {
  if (isLoading && !hasData) return <ChartSkeleton height={height} />;
  if (!isLoading && !hasData) return <ChartEmpty height={height} />;
  return (
    <div className="relative">
      <div className={isLoading ? "pointer-events-none select-none opacity-50 blur-[2px] transition-all duration-300" : "transition-all duration-300"}>
        {children}
      </div>
      {isLoading && <RefreshingOverlay />}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PortfolioCharts({
  chart,
  assets,
  forecast,
  forecastError,
  isForecastLoading,
  onRefreshForecast,
  isLoading,
}: PortfolioChartsProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("24h");
  const [isForecastDialogOpen, setForecastDialogOpen] = useState(false);

  // ── Filtered chart data ────────────────────────────────────────────────────
  const filteredChart = useMemo(() => {
    if (chart.length === 0) return [];
    if (timeframe === "All") return chart;
    const windowMs = TIMEFRAME_MS[timeframe]!;
    const cutoff = Date.now() - windowMs;
    const filtered = chart.filter((p) => new Date(p.time).getTime() >= cutoff);
    const lastBefore = [...chart].reverse().find((p) => new Date(p.time).getTime() < cutoff);
    if (lastBefore) filtered.unshift(lastBefore);
    return filtered.length >= 2 ? filtered : chart;
  }, [chart, timeframe]);

  // ── History chart values ───────────────────────────────────────────────────
  const historyValues = useMemo(() => filteredChart.map((p) => p.totalValueUsd), [filteredChart]);
  const historyRange = useMemo(() => getStableRange(historyValues, timeframe === "All"), [historyValues, timeframe]);
  const historyPath = useMemo(() => chartValuesToPath(historyValues, historyRange), [historyValues, historyRange]);
  const historyArea = chartAreaPath(historyPath);
  const historyTicks = useMemo(() => createTicks(historyRange.min, historyRange.max), [historyRange]);
  const historyColor = trendColorByDirection(historyValues[0] ?? 0, historyValues[historyValues.length - 1] ?? 0);

  // ── Current value stats for header ────────────────────────────────────────
  const currentValue = historyValues[historyValues.length - 1] ?? 0;
  const startValue = historyValues[0] ?? 0;
  const valueChange = currentValue - startValue;
  const valueChangePercent = startValue > 0 ? (valueChange / startValue) * 100 : 0;
  const isPositive = valueChange >= 0;

  // ── Allocation ─────────────────────────────────────────────────────────────
  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  const allocationSegments = useMemo(() => {
    const raw = assets
      .map((a) => {
        const v = Number(a.allocationPercent);
        return { symbol: a.symbol, label: allocationLabel(a.symbol), allocationPercent: Number.isFinite(v) ? Math.max(0, v) : 0 };
      })
      .filter((a) => a.allocationPercent > 0);
    const total = raw.reduce((s, a) => s + a.allocationPercent, 0);
    if (total <= 0) return [];
    return [...raw]
      .sort((a, b) => b.allocationPercent !== a.allocationPercent ? b.allocationPercent - a.allocationPercent : a.symbol.localeCompare(b.symbol))
      .map((a) => ({ ...a, normalizedPercent: (a.allocationPercent / total) * 100 }));
  }, [assets]);

  const allocationRings = useMemo(() => {
    let offset = 0;
    return allocationSegments.map((seg, i) => {
      const dash = (circumference * seg.normalizedPercent) / 100;
      const ring = {
        ...seg,
        color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
        dash,
        gap: Math.max(circumference - dash, 0),
        offset: -offset,
      };
      offset += dash;
      return ring;
    });
  }, [allocationSegments, circumference]);

  // ── X-axis labels ──────────────────────────────────────────────────────────
  const chartLabels = useMemo(() => {
    const hourMode = timeframe === "24h";
    if (filteredChart.length < 2) return filteredChart.map((p) => formatAxisLabel(p.time, hourMode));
    const COUNT = 5;
    const t0 = new Date(filteredChart[0].time).getTime();
    const t1 = new Date(filteredChart[filteredChart.length - 1].time).getTime();
    const labels: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < COUNT; i++) {
      const target = t0 + (t1 - t0) * (i / (COUNT - 1));
      let nearest = filteredChart[0];
      let minDiff = Infinity;
      for (const pt of filteredChart) {
        const diff = Math.abs(new Date(pt.time).getTime() - target);
        if (diff < minDiff) { minDiff = diff; nearest = pt; }
      }
      const label = formatAxisLabel(nearest.time, hourMode);
      labels.push(seen.has(label) ? "" : label);
      seen.add(label);
    }
    return labels;
  }, [filteredChart, timeframe]);

  // ── Hover states ───────────────────────────────────────────────────────────
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const hoveredSeg = allocationRings.find((s) => s.symbol === hoveredSymbol) ?? null;

  const historyHover = useChartHover(historyValues.length);
  const hFrac = historyHover.hover?.fracIndex ?? null;
  const hValue = hFrac != null ? interpValue(historyValues, hFrac) : null;
  const hTime = hFrac != null ? interpTime(filteredChart, hFrac) : null;
  const hDate = hTime ? formatTooltipDate(hTime) : null;
  const hCrossX = historyHover.hover?.rawSvgX ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="mb-6 lg:mb-8">
      <article className="panel-base overflow-hidden">
        <div className="flex flex-col divide-y divide-white/8 lg:flex-row lg:divide-x lg:divide-y-0">

          {/* ── Allocation panel (left) ──────────────────────────────────── */}
          <div className="shrink-0 p-5 sm:p-6 lg:w-60 xl:w-64">
            {/* Header */}
            <div className="mb-5">
              <h3 className="section-title">Allocation</h3>
              <p className="mt-0.5 text-xs text-muted">{allocationSegments.length} assets</p>
            </div>

            {/* Donut + legend */}
            <div className="flex items-center gap-6 lg:flex-col lg:items-center lg:gap-5">
              {/* Donut */}
              <div className="relative h-32 w-32 shrink-0 text-(--surface-container-highest)">
                <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90 transform">
                  <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth="16" />
                  {allocationRings.map((seg) => (
                    <circle
                      key={seg.symbol}
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="none"
                      style={{
                        stroke: seg.color,
                        opacity: hoveredSymbol != null && hoveredSymbol !== seg.symbol ? 0.25 : 1,
                        transition: "opacity 150ms ease",
                        cursor: "pointer",
                      }}
                      strokeWidth={hoveredSymbol === seg.symbol ? 20 : 16}
                      strokeLinecap="butt"
                      strokeDasharray={`${seg.dash} ${seg.gap}`}
                      strokeDashoffset={seg.offset}
                      onMouseEnter={() => setHoveredSymbol(seg.symbol)}
                      onMouseLeave={() => setHoveredSymbol(null)}
                    />
                  ))}
                </svg>
                {/* Center label on hover */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  {hoveredSeg != null && (
                    <>
                      <span className="text-sm font-bold leading-tight text-strong">{hoveredSeg.label}</span>
                      <span className="mt-0.5 text-xs text-muted">{hoveredSeg.normalizedPercent.toFixed(1)}%</span>
                    </>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="max-h-48 min-w-0 flex-1 space-y-2.5 overflow-y-auto lg:w-full lg:flex-none">
                {allocationRings.length === 0 && <div className="text-xs text-muted">No assets available</div>}
                {allocationRings.map((seg) => (
                  <div
                    key={seg.symbol}
                    className="flex cursor-default items-center justify-between gap-2 transition-opacity duration-150"
                    style={{ opacity: hoveredSymbol != null && hoveredSymbol !== seg.symbol ? 0.3 : 1 }}
                    onMouseEnter={() => setHoveredSymbol(seg.symbol)}
                    onMouseLeave={() => setHoveredSymbol(null)}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                      <span className="truncate text-xs font-semibold text-strong">{seg.label}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{seg.normalizedPercent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Portfolio Performance panel (right) ──────────────────────── */}
          <div className="flex-1 p-5 sm:p-6">
            {/* Header: title + stats + timeframe buttons */}
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="section-title">Portfolio Performance</h3>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-strong">
                    {formatUsdCompact(currentValue)}
                  </span>
                  <span className={`text-sm font-semibold ${isPositive ? "text-positive" : "text-danger"}`}>
                    {isPositive ? "+" : ""}{valueChangePercent.toFixed(2)}%
                  </span>
                  <span className={`text-sm ${isPositive ? "text-positive" : "text-danger"} opacity-75`}>
                    ({isPositive ? "+" : ""}{formatUsdCompact(valueChange)})
                  </span>
                </div>
              </div>

              {/* Timeframe buttons */}
              <div className="flex rounded-xl bg-(--surface-container-highest) p-1">
                {timeframes.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTimeframe(option)}
                    className={
                      option === timeframe
                        ? "rounded-lg bg-(--surface-bright) px-3 py-1 text-[0.6rem] font-semibold text-strong"
                        : "px-3 py-1 text-[0.6rem] font-medium text-muted hover:text-strong"
                    }
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setForecastDialogOpen(true)}
                data-tour="forecast-btn"
                className="group relative inline-flex items-center gap-1.5 rounded-full border border-[#F0B90B]/30 bg-[#F0B90B]/8 px-3 py-[0.38rem] text-[0.92rem] font-medium tracking-[0.01em] text-[#F0B90B] shadow-[inset_0_0_0_1px_rgba(240,185,11,0.04)] transition hover:border-[#F0B90B]/50 hover:bg-[#F0B90B]/12 hover:text-[#FFD86B]"
                style={{ fontFamily: "var(--font-display)" }}
                aria-label="Forecast next 48h"
              >
                <MaterialIcon name="auto_awesome" outlined={false} className="text-[0.9rem] text-[#F0B90B]" />
                <span>Forecast</span>
                <span
                  className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#3B2E0D] bg-[#111418] px-2.5 py-1 text-[0.62rem] tracking-[0.12em] text-[#F0B90B] opacity-0 shadow-lg transition duration-150 group-hover:opacity-100"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Forecast next 48h
                </span>
              </button>
            </div>

            {/* Chart */}
            <ChartWrapper isLoading={!!isLoading} hasData={historyValues.length > 0} height="h-64">
              <div
                ref={historyHover.containerRef}
                className="relative h-64 cursor-crosshair select-none"
                onMouseMove={historyHover.handleMouseMove}
                onMouseLeave={historyHover.handleMouseLeave}
              >
                {/* SVG chart area */}
                <div className="absolute inset-0 pb-6 pr-20 pt-2">
                  <svg
                    ref={historyHover.svgRef}
                    viewBox="0 0 100 50"
                    preserveAspectRatio="none"
                    className="h-full w-full overflow-visible"
                  >
                    <defs>
                      <linearGradient id="history-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={historyColor} stopOpacity={GRADIENT_TOP_OPACITY} />
                        <stop offset="100%" stopColor={historyColor} stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal grid lines */}
                    {historyTicks.map((tick, i) => {
                      const y = svgY(tick, historyRange);
                      return (
                        <line
                          key={i}
                          x1="0" y1={y.toFixed(2)}
                          x2="100" y2={y.toFixed(2)}
                          stroke="white"
                          strokeOpacity="0.07"
                          strokeWidth="0.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })}

                    {/* Area fill */}
                    <path d={historyArea} fill="url(#history-gradient)" />

                    {/* Line */}
                    <path
                      d={historyPath}
                      fill="none"
                      style={{ stroke: historyColor }}
                      strokeWidth={LINE_STROKE_WIDTH}
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* Crosshair */}
                    {hCrossX != null && (
                      <line
                        x1={hCrossX} y1="0"
                        x2={hCrossX} y2={CHART_BASELINE}
                        stroke="white"
                        strokeOpacity="0.35"
                        strokeWidth="0.6"
                        strokeDasharray="2.5 2"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </svg>
                </div>

                {/* Y-axis labels */}
                <div className="pointer-events-none absolute inset-y-0 right-0 w-20 pb-6 pt-2">
                  <div className="relative h-full">
                    {historyTicks.map((tick, i) => (
                      <span
                        key={i}
                        className="absolute right-1 -translate-y-1/2 text-right text-[10px] text-subtle"
                        style={{ top: `${(svgY(tick, historyRange) / 50) * 100}%` }}
                      >
                        {formatUsdTick(tick)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Hover tooltip */}
                {historyHover.hover != null && hValue != null && hDate != null && (
                  <div
                    className="pointer-events-none absolute top-[55%] z-10 -translate-x-1/2 rounded-xl bg-(--surface-container-highest) px-3.5 py-2.5 shadow-xl ring-1 ring-white/10"
                    style={{ left: historyHover.hover.tooltipLeftPx }}
                  >
                    <div className="mb-1.5 flex items-baseline gap-2 whitespace-nowrap text-[11px]">
                      <span className="font-semibold text-strong">{hDate.date}</span>
                      <span className="text-muted">{hDate.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: historyColor }} />
                      <span className="text-muted">Total Value:</span>
                      <span className="font-bold text-strong">{formatUsdTooltip(hValue)}</span>
                    </div>
                  </div>
                )}

                {/* X-axis labels */}
                <div className="absolute bottom-0 left-0 right-20 flex justify-between text-[10px] text-subtle">
                  {chartLabels.map((label, i) => (
                    <span key={i}>{label}</span>
                  ))}
                </div>
              </div>
            </ChartWrapper>
          </div>

        </div>
      </article>

      <PortfolioForecastDialog
        open={isForecastDialogOpen}
        onClose={() => setForecastDialogOpen(false)}
        chart={filteredChart}
        forecast={forecast}
        forecastError={forecastError}
        isForecastLoading={!!isForecastLoading}
        onRefreshForecast={onRefreshForecast}
      />
    </section>
  );
}
