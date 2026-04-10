"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import type { PortfolioAssetRow, PortfolioChartPoint } from "@/app/lib/portfolio-types";

type PortfolioChartsProps = {
  chart: PortfolioChartPoint[];
  assets: PortfolioAssetRow[];
  allTimeProfitPercent: number;
  isLoading?: boolean;
};

const timeframes = ["24h", "7d", "30d", "90d"] as const;
type Timeframe = (typeof timeframes)[number];
type HoldingsView = "History" | "Allocation";

const CHART_BASELINE = 50;
const CHART_HEIGHT = 35;
const TICK_COUNT = 5;
const LINE_STROKE_WIDTH = 1.5;
const GRADIENT_TOP_OPACITY = 0.18;

const THEME_COLORS = {
  primary: "var(--color-primary)",
  danger: "var(--text-danger)",
  info: "var(--text-info)",
  warning: "var(--text-warning)"
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

type ValueRange = { min: number; max: number; spread: number };

function getValueRange(values: number[]): ValueRange {
  if (values.length === 0) return { min: 0, max: 1, spread: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, spread: Math.max(max - min, 1) };
}

/**
 * Stable range for chart rendering.
 *
 * Only the last chart point is the "live tail" — it mutates every tick.
 * Using it for range calculation would cause the entire chart to rescale
 * on every price update, making historical points appear to dance.
 *
 * Rules:
 * - With enough history (> 10 pts), exclude the tail from range anchor so
 *   live price ticks don't rescale every historical point.
 * - With few points (≤ 10), use all values — slicing to 1 anchor creates a
 *   near-zero spread that sends points wildly off-screen.
 * - Always ensure a minimum spread of 0.2 % of the max value so a flat
 *   portfolio (all equal values) still gets readable Y-axis ticks.
 * - Add 8 % padding so the line never touches the top/bottom edges.
 */
function getStableRange(values: number[]): ValueRange {
  if (values.length === 0) return { min: 0, max: 1, spread: 1 };

  const anchor = values.length > 10 ? values.slice(0, -1) : values;
  const raw = getValueRange(anchor);

  // Ensure minimum spread relative to value magnitude (prevents $9,982/$9,982/... axis)
  const minSpread = Math.max(raw.max * 0.002, 1);
  const spread = Math.max(raw.spread, minSpread);
  const mid = (raw.min + raw.max) / 2;
  const pad = spread * 0.08;

  return {
    min: mid - spread / 2 - pad,
    max: mid + spread / 2 + pad,
    spread: spread + 2 * pad
  };
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
  maximumFractionDigits: 0
});

const usdTooltipFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatUsdTick(v: number) { return usdAxisFormatter.format(v); }
function formatUsdTooltip(v: number) { return usdTooltipFormatter.format(v); }
function formatPercentTick(v: number) { return `${v.toFixed(2)}%`; }

const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric"
});

const tooltipTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZoneName: "short"
});

const axisLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric"
});

function formatTooltipDate(time: string): { date: string; time: string } {
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return { date: time, time: "" };
  return {
    date: tooltipDateFormatter.format(d).replace(",", "."),
    time: tooltipTimeFormatter.format(d)
  };
}

function formatAxisLabel(time: string): string {
  const d = new Date(time);
  return Number.isNaN(d.getTime()) ? time : axisLabelFormatter.format(d);
}

function performanceValues(points: PortfolioChartPoint[]): number[] {
  if (points.length === 0) return [0];
  const base = points[0]?.totalValueUsd || 1;
  return points.map((p) => ((p.totalValueUsd - base) / base) * 100);
}

function allocationLabel(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.endsWith("USDT") || upper.endsWith("BUSD")) return upper.slice(0, -4);
  if (upper.endsWith("BTC") && upper.length > 3) return upper.slice(0, -3);
  return upper;
}

// ── Hover hook ──────────────────────────────────────────────────────────────
type HoverState = {
  index: number;
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
      const index = Math.round(xRatio * (valuesLength - 1));
      const rawLeft = e.clientX - containerRect.left;
      const tooltipLeftPx = Math.max(60, Math.min(containerRect.width - 100, rawLeft));
      setHover({ index, tooltipLeftPx });
    },
    [valuesLength]
  );

  const handleMouseLeave = useCallback(() => setHover(null), []);

  return { hover, svgRef, containerRef, handleMouseMove, handleMouseLeave };
}

function svgY(value: number, range: ValueRange): number {
  return CHART_BASELINE - ((value - range.min) / range.spread) * CHART_HEIGHT;
}

const TIMEFRAME_MS: Record<Timeframe, number> = {
  "24h": 24 * 3_600_000,
  "7d": 7 * 24 * 3_600_000,
  "30d": 30 * 24 * 3_600_000,
  "90d": 90 * 24 * 3_600_000,
};

// ── Loading states ──────────────────────────────────────────────────────────
function ChartSkeleton({ height = "h-72" }: { height?: string }) {
  return (
    <div className={`${height} relative overflow-hidden rounded-xl bg-(--surface-container-low)`}>
      {/* Subtle grid lines mimicking the chart background */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between px-2 py-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-px w-full bg-white opacity-[0.04]" />
        ))}
      </div>
      {/* Loading badge — same position and style as RefreshingOverlay */}
      <div className="absolute bottom-8 right-20 flex items-center gap-1.5 rounded-full bg-(--surface-container-highest) px-2.5 py-1 opacity-80 shadow ring-1 ring-white/10">
        <Spinner />
        <span className="text-[10px] text-muted">Loading…</span>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2.5 rounded-xl backdrop-blur-[3px]">
      <Spinner />
      <span className="text-[11px] font-medium text-muted">Loading chart data…</span>
    </div>
  );
}

function RefreshingOverlay() {
  return (
    <div className="absolute bottom-8 right-20 z-20 flex items-center gap-1.5 rounded-full bg-(--surface-container-highest) px-2.5 py-1 opacity-80 shadow ring-1 ring-white/10">
      <Spinner />
      <span className="text-[10px] text-muted">Updating…</span>
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
  children
}: {
  isLoading: boolean;
  hasData: boolean;
  height: string;
  children: React.ReactNode;
}) {
  // Loading (cold start or portfolio switch) — show skeleton
  if (isLoading && !hasData) return <ChartSkeleton height={height} />;

  // Loaded but nothing to show
  if (!isLoading && !hasData) return <ChartEmpty height={height} />;

  // Has data — show chart, with refresh overlay if updating in background
  return (
    <div className="relative">
      <div className={isLoading ? "pointer-events-none select-none opacity-50 blur-[2px] transition-all duration-300" : "transition-all duration-300"}>
        {children}
      </div>
      {isLoading && <RefreshingOverlay />}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function PortfolioCharts({ chart, assets, allTimeProfitPercent, isLoading }: PortfolioChartsProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("90d");
  const [holdingsView, setHoldingsView] = useState<HoldingsView>("History");

  const filteredChart = useMemo(() => {
    if (chart.length === 0) return [];
    const cutoff = Date.now() - TIMEFRAME_MS[timeframe];
    const filtered = chart.filter((p) => new Date(p.time).getTime() >= cutoff);
    if (filtered.length >= 2) return filtered;
    // Not enough data in the selected window — show the N most-recent points
    // that roughly cover that period. Never fall back to the full 35-day set,
    // which would mix wildly different scales into a short-timeframe view.
    const recentCount = timeframe === "24h" ? 2 : timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;
    return chart.slice(-recentCount);
  }, [chart, timeframe]);

  // ── History ────────────────────────────────────────────────────────────────
  const historyValues = useMemo(() => filteredChart.map((p) => p.totalValueUsd), [filteredChart]);
  const historyRange = useMemo(() => getStableRange(historyValues), [historyValues]);
  const historyPath = useMemo(() => chartValuesToPath(historyValues, historyRange), [historyValues, historyRange]);
  const historyArea = chartAreaPath(historyPath);
  const historyTicks = useMemo(() => createTicks(historyRange.min, historyRange.max), [historyRange]);
  const historyColor = trendColorByDirection(historyValues[0] ?? 0, historyValues[historyValues.length - 1] ?? 0);

  // ── Performance ────────────────────────────────────────────────────────────
  const performance = performanceValues(filteredChart);
  const allTimeProfitDisplayPercent = useMemo(() => {
    const r = getValueRange(performance);
    const pad = Math.max(r.spread * 0.6, 5);
    return Math.min(r.max + pad, Math.max(r.min - pad, allTimeProfitPercent));
  }, [performance, allTimeProfitPercent]);
  const allTimeProfitSeries = (performance.length ? performance : [0]).map(() => allTimeProfitDisplayPercent);
  const performanceRange = getStableRange([...performance, ...allTimeProfitSeries]);
  const performanceTicks = createTicks(performanceRange.min, performanceRange.max);
  const btcPath = chartValuesToPath(performance, performanceRange);
  const profitPath = chartValuesToPath(allTimeProfitSeries, performanceRange);
  const btcArea = chartAreaPath(btcPath);
  const profitArea = chartAreaPath(profitPath);
  const btcColor = THEME_COLORS.warning;
  const profitColor = THEME_COLORS.info;

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
      const ring = { ...seg, color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length], dash, gap: Math.max(circumference - dash, 0), offset: -offset };
      offset += dash;
      return ring;
    });
  }, [allocationSegments, circumference]);

  // ── Axis labels ────────────────────────────────────────────────────────────
  const chartLabels = useMemo(() => {
    if (filteredChart.length === 0) return [];
    const count = Math.min(5, filteredChart.length);
    return Array.from({ length: count }, (_, i) => {
      const idx = Math.round((i / Math.max(count - 1, 1)) * (filteredChart.length - 1));
      return formatAxisLabel(filteredChart[idx].time);
    });
  }, [filteredChart]);

  // ── Hover ──────────────────────────────────────────────────────────────────
  const historyHover = useChartHover(historyValues.length);
  const perfHover = useChartHover(performance.length);

  const hIdx = historyHover.hover?.index;
  const hValue = hIdx != null ? historyValues[hIdx] : null;
  const hPoint = hIdx != null ? filteredChart[hIdx] : null;
  const hDate = hPoint ? formatTooltipDate(hPoint.time) : null;
  const hCrossX = hIdx != null ? (hIdx / Math.max(historyValues.length - 1, 1)) * 100 : null;

  const pIdx = perfHover.hover?.index;
  const pPerf = pIdx != null ? performance[pIdx] : null;
  const pProfit = pIdx != null ? allTimeProfitSeries[pIdx] : null;
  const pPoint = pIdx != null ? filteredChart[pIdx] : null;
  const pDate = pPoint ? formatTooltipDate(pPoint.time) : null;
  const pCrossX = pIdx != null ? (pIdx / Math.max(performance.length - 1, 1)) * 100 : null;

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 md:gap-6 lg:mb-8 lg:grid-cols-[2fr_1fr]">

      {/* ── Holdings ──────────────────────────────────────────────────────── */}
      <article className="panel-base overflow-hidden p-5 sm:p-6">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h3 className="section-title shrink-0">Holdings</h3>
          <div className="flex flex-1 justify-end gap-2">
            {/* Timeframes */}
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
                  {option}
                </button>
              ))}
            </div>
            {/* View toggle */}
            <div className="flex rounded-xl bg-(--surface-container-highest) p-1">
              {(["History", "Allocation"] as HoldingsView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setHoldingsView(view)}
                  className={
                    view === holdingsView
                      ? "rounded-lg bg-(--surface-bright) px-3 py-1 text-[0.6rem] font-semibold text-strong"
                      : "px-3 py-1 text-[0.6rem] font-medium text-muted hover:text-strong"
                  }
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </div>

        {holdingsView === "History" ? (
          <ChartWrapper isLoading={!!isLoading} hasData={historyValues.length > 0} height="h-72">
          {/* History chart */}
          <div
            ref={historyHover.containerRef}
            className="relative h-72 cursor-crosshair select-none"
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

                {/* Horizontal grid lines at each tick */}
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

                <path d={historyArea} fill="url(#history-gradient)" />
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
            <div className="pointer-events-none absolute inset-y-0 right-0 flex w-20 flex-col justify-between pb-6 pt-2 text-right text-[10px] text-subtle">
              {historyTicks.map((tick, i) => (
                <span key={i}>{formatUsdTick(tick)}</span>
              ))}
            </div>

            {/* Tooltip */}
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
        ) : (
          /* Allocation view */
          <div className="flex h-72 items-center justify-center gap-10">
            <div className="relative h-44 w-44 shrink-0 text-(--surface-container-highest)">
              <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90 transform">
                <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth="16" />
                {allocationRings.map((seg) => (
                  <circle
                    key={seg.symbol}
                    cx="80" cy="80" r={radius}
                    fill="none"
                    style={{ stroke: seg.color }}
                    strokeWidth="16"
                    strokeLinecap="butt"
                    strokeDasharray={`${seg.dash} ${seg.gap}`}
                    strokeDashoffset={seg.offset}
                  />
                ))}
              </svg>
            </div>
            <div className="max-h-52 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {allocationRings.length === 0 && <div className="text-xs text-muted">No assets available</div>}
              {allocationRings.map((seg) => (
                <div key={seg.symbol} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                    <span className="truncate text-xs font-semibold text-strong">{seg.label}</span>
                  </div>
                  <span className="text-xs text-muted">{seg.normalizedPercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* ── Performance ───────────────────────────────────────────────────── */}
      <article className="panel-base p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="section-title">Performance</h3>
          <svg className="h-3.5 w-3.5 text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="8" cy="8" r="7" />
            <path d="M8 7v4M8 5.5v.5" strokeLinecap="round" />
          </svg>
        </div>

        <div className="mb-4 flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: profitColor }} />
            <span className="text-muted">All-time profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: btcColor }} />
            <span className="text-muted">BTC trend</span>
          </div>
        </div>

        <ChartWrapper isLoading={!!isLoading} hasData={performance.length > 0} height="h-64">
        <div
          ref={perfHover.containerRef}
          className="relative h-64 cursor-crosshair select-none overflow-hidden rounded-xl bg-(--surface-container-low)"
          onMouseMove={perfHover.handleMouseMove}
          onMouseLeave={perfHover.handleMouseLeave}
        >
          <svg
            ref={perfHover.svgRef}
            viewBox="0 0 100 50"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full pr-14"
          >
            <defs>
              <linearGradient id="btc-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={btcColor} stopOpacity={GRADIENT_TOP_OPACITY} />
                <stop offset="100%" stopColor={btcColor} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="profit-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={profitColor} stopOpacity={GRADIENT_TOP_OPACITY} />
                <stop offset="100%" stopColor={profitColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={btcArea} fill="url(#btc-gradient)" />
            <path d={profitArea} fill="url(#profit-gradient)" />
            <path d={profitPath} fill="none" style={{ stroke: profitColor }} strokeWidth={LINE_STROKE_WIDTH} strokeDasharray="4 2" vectorEffect="non-scaling-stroke" />
            <path d={btcPath} fill="none" style={{ stroke: btcColor }} strokeWidth={LINE_STROKE_WIDTH} vectorEffect="non-scaling-stroke" />
            {pCrossX != null && (
              <line
                x1={pCrossX} y1="0"
                x2={pCrossX} y2={CHART_BASELINE}
                stroke="white"
                strokeOpacity="0.35"
                strokeWidth="0.6"
                strokeDasharray="2.5 2"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* Y-axis labels */}
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-14 flex-col justify-between pb-6 pt-2 text-right text-[10px] text-subtle">
            {performanceTicks.map((tick, i) => (
              <span key={i}>{formatPercentTick(tick)}</span>
            ))}
          </div>

          {/* Tooltip */}
          {perfHover.hover != null && pDate != null && (
            <div
              className="pointer-events-none absolute top-[50%] z-20 -translate-x-1/2 rounded-xl bg-(--surface-container-highest) px-3 py-2 shadow-xl ring-1 ring-white/10"
              style={{ left: perfHover.hover.tooltipLeftPx }}
            >
              <div className="mb-1.5 whitespace-nowrap text-[10px] font-semibold text-strong">{pDate.date}</div>
              {pProfit != null && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: profitColor }} />
                  <span className="text-muted">Profit:</span>
                  <span className="font-semibold text-strong">{formatPercentTick(pProfit)}</span>
                </div>
              )}
              {pPerf != null && (
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: btcColor }} />
                  <span className="text-muted">BTC:</span>
                  <span className="font-semibold text-strong">{formatPercentTick(pPerf)}</span>
                </div>
              )}
            </div>
          )}

          {/* X-axis labels */}
          <div className="absolute bottom-1 left-0 right-14 flex justify-between px-1 text-[10px] text-subtle">
            {chartLabels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
        </div>
        </ChartWrapper>
      </article>

    </section>
  );
}
