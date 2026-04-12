"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import type { PortfolioAssetRow, PortfolioChartPoint } from "@/app/lib/portfolio-types";

type PortfolioChartsProps = {
  chart: PortfolioChartPoint[];
  assets: PortfolioAssetRow[];
  allTimeProfitPercent: number;
  totalCostBasisUsd: number;
  isLoading?: boolean;
};

const timeframes = ["24h", "7d", "30d", "90d", "All"] as const;
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
/**
 * zeroBaseline=true  → "All" timeframe: pin Y-axis to $0 so you see true scale of growth.
 * zeroBaseline=false → short timeframes: auto-scale into the visible range so small
 *                      movements (e.g. $49k–$51k on a 24h view) are actually readable.
 */
function getStableRange(values: number[], zeroBaseline = false): ValueRange {
  if (values.length === 0) return { min: 0, max: 1, spread: 1 };

  const fullMin = Math.min(...values);
  const fullMax = Math.max(...values);

  // Compute range from full data (including live tail) for tight CMC-style fit.
  const dataSpread = Math.max(fullMax - fullMin, 1);
  // 5 % of the actual data spread — just enough breathing room so the line
  // never touches the very top/bottom edge of the chart.
  const pad = Math.max(dataSpread * 0.05, 1);
  const hi = fullMax + pad;
  // Portfolio value can never be negative — clamp floor to 0 at all times.
  const lo = Math.max(0, fullMin - pad);

  if (zeroBaseline) {
    // "All" view: pin floor to $0 so long-term growth shape is preserved.
    return { min: 0, max: hi, spread: hi };
  }

  // Short timeframes: tight zoom so even small intraday moves fill the chart.
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

/**
 * Fixed-interval ticks centered on 0 — for percentage charts like CMC.
 * Picks the smallest step (5%, 10%, 25%…) that keeps tick count reasonable,
 * then generates ticks at multiples of that step covering [min, max].
 */
function createPercentTicks(min: number, max: number): number[] {
  const absMax = Math.max(Math.abs(min), Math.abs(max));
  // Pick step so we get roughly 4–8 ticks either side of 0
  const steps = [1, 2, 5, 10, 25, 50, 100];
  const step = steps.find((s) => absMax / s <= 5) ?? 100;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = hi; v >= lo; v -= step) ticks.push(v);
  return ticks;
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
// Axis ticks are always whole numbers (5%, 10% etc) — no decimals needed.
// Tooltip values keep 2 decimal places for precision.
function formatPercentTick(v: number) { return `${Number.isInteger(v) ? v : v.toFixed(1)}%`; }
function formatPercentTooltip(v: number) { return `${v.toFixed(2)}%`; }

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

const axisHourFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

function formatTooltipDate(time: string): { date: string; time: string } {
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return { date: time, time: "" };
  return {
    date: tooltipDateFormatter.format(d).replace(",", "."),
    time: tooltipTimeFormatter.format(d)
  };
}

function formatAxisLabel(time: string, hourMode = false): string {
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return time;
  return hourMode ? axisHourFormatter.format(d) : axisLabelFormatter.format(d);
}

function btcTrendValues(points: PortfolioChartPoint[]): number[] | null {
  if (points.length === 0) return null;
  const base = points[0]?.btcPriceUsd;
  if (!base) return null;
  return points.map((p) => {
    if (p.btcPriceUsd == null) return 0;
    return ((p.btcPriceUsd - base) / base) * 100;
  });
}

function allocationLabel(symbol: string): string {
  const upper = symbol.toUpperCase();
  // Strip quote-currency suffix only for trading pairs (e.g. BTCUSDT → BTC),
  // never when the symbol IS the quote currency itself (e.g. USDT → USDT).
  if ((upper.endsWith("USDT") || upper.endsWith("BUSD")) && upper.length > 4) return upper.slice(0, -4);
  if (upper.endsWith("BTC") && upper.length > 3) return upper.slice(0, -3);
  return upper;
}

// ── Hover hook ──────────────────────────────────────────────────────────────
type HoverState = {
  fracIndex: number;    // fractional data index — enables interpolation between points
  rawSvgX: number;      // exact mouse X in SVG units 0–100 — used for crosshair
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
      // Fractional (not rounded) — used for interpolation
      const fracIndex = xRatio * (valuesLength - 1);
      const rawSvgX = xRatio * 100;
      const rawLeft = e.clientX - containerRect.left;
      const tooltipLeftPx = Math.max(60, Math.min(containerRect.width - 100, rawLeft));
      setHover({ fracIndex, rawSvgX, tooltipLeftPx });
    },
    [valuesLength]
  );

  const handleMouseLeave = useCallback(() => setHover(null), []);

  return { hover, svgRef, containerRef, handleMouseMove, handleMouseLeave };
}

/** Linearly interpolate a numeric series at a fractional index. */
function interpValue(values: number[], fracIdx: number): number {
  if (values.length === 0) return 0;
  const i0 = Math.max(0, Math.min(Math.floor(fracIdx), values.length - 2));
  const i1 = i0 + 1;
  const t = fracIdx - i0;
  return values[i0] * (1 - t) + values[i1] * t;
}

/** Linearly interpolate a timestamp at a fractional index over a chart series. */
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
  // "All" has no fixed window — it always renders the full available history
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
      {/* Centered loading indicator */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <svg
          className="h-8 w-8 animate-spin text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </svg>
        <span className="text-sm text-muted">Loading…</span>
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
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3">
      <svg
        className="h-8 w-8 animate-spin text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
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
export function PortfolioCharts({ chart, assets, allTimeProfitPercent, totalCostBasisUsd, isLoading }: PortfolioChartsProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("90d");
  const [holdingsView, setHoldingsView] = useState<HoldingsView>("History");

  const filteredChart = useMemo(() => {
    if (chart.length === 0) return [];
    // "All" always renders the full effective history (backfill + reconstructed)
    if (timeframe === "All") return chart;
    const windowMs = TIMEFRAME_MS[timeframe]!;
    const cutoff = Date.now() - windowMs;
    const filtered = chart.filter((p) => new Date(p.time).getTime() >= cutoff);
    // Prepend the last candle that opened *before* the cutoff so the line starts
    // right at the window edge instead of jumping to the nearest hourly boundary.
    // e.g. for 24h at 3:20 AM, include the 3:00 AM candle so the chart starts ~24h ago.
    const lastBefore = [...chart].reverse().find((p) => new Date(p.time).getTime() < cutoff);
    if (lastBefore) filtered.unshift(lastBefore);
    // If the portfolio doesn't have enough history for the requested window yet,
    // fall back to rendering everything we have rather than disabling the tab.
    return filtered.length >= 2 ? filtered : chart;
  }, [chart, timeframe]);

  // ── History ────────────────────────────────────────────────────────────────
  const historyValues = useMemo(() => filteredChart.map((p) => p.totalValueUsd), [filteredChart]);
  const historyRange = useMemo(() => getStableRange(historyValues, timeframe === "All"), [historyValues, timeframe]);
  const historyPath = useMemo(() => chartValuesToPath(historyValues, historyRange), [historyValues, historyRange]);
  const historyArea = chartAreaPath(historyPath);
  const historyTicks = useMemo(() => createTicks(historyRange.min, historyRange.max), [historyRange]);
  const historyColor = trendColorByDirection(historyValues[0] ?? 0, historyValues[historyValues.length - 1] ?? 0);

  // ── Performance ────────────────────────────────────────────────────────────
  // Performance always uses the full chart regardless of selected timeframe (same as CMC).
  // Only include points that have a known cost basis (i.e. after first transaction).
  const perfChart = useMemo(() => chart.filter((p) => p.costBasisUsd !== null && p.costBasisUsd > 0), [chart]);

  // Line 1: running PNL % = (portfolioValue(t) - costBasis(t)) / costBasis(t) × 100
  // costBasis(t) is the running invested capital at that point — not current total.
  const allTimeProfitSeries = useMemo(() => {
    if (perfChart.length === 0) return [allTimeProfitPercent];
    return perfChart.map((p) => ((p.totalValueUsd - p.costBasisUsd!) / p.costBasisUsd!) * 100);
  }, [perfChart, allTimeProfitPercent]);

  // Line 2: BTC % change over the same window — correlation benchmark
  const btcTrend = useMemo(() => btcTrendValues(perfChart), [perfChart]);

  const performanceTicks = useMemo(() => {
    const all = [...(btcTrend ?? []), ...allTimeProfitSeries, 0];
    const fullMin = Math.min(...all);
    const fullMax = Math.max(...all);
    return createPercentTicks(fullMin, fullMax);
  }, [btcTrend, allTimeProfitSeries]);

  // Range is derived from ticks so lines always land on a tick gridline
  const performanceRange = useMemo(() => {
    if (performanceTicks.length === 0) return { min: -10, max: 10, spread: 20 };
    const lo = performanceTicks[performanceTicks.length - 1];
    const hi = performanceTicks[0];
    return { min: lo, max: hi, spread: hi - lo };
  }, [performanceTicks]);
  const btcPath = btcTrend ? chartValuesToPath(btcTrend, performanceRange) : null;
  const profitPath = chartValuesToPath(allTimeProfitSeries, performanceRange);
  const btcColor = "#F7931A";    // Bitcoin official orange — BTC benchmark
  const profitColor = "#3861FB"; // CMC brand blue — all-time profit
  // Y position of the 0 % baseline in SVG units — used for the reference line
  const zeroY = svgY(0, performanceRange);

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
  // Pick 5 labels at evenly-spaced TIMESTAMPS (not indices).
  // Index-based spacing clusters labels in the dense hourly region at the end
  // of the chart (e.g. showing "Apr 11" × 4 when daily + hourly klines are mixed).
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

  // Performance x-axis: always full history (perfChart), always date mode (no hour mode)
  const perfChartLabels = useMemo(() => {
    if (perfChart.length < 2) return perfChart.map((p) => formatAxisLabel(p.time));
    const COUNT = 5;
    const t0 = new Date(perfChart[0].time).getTime();
    const t1 = new Date(perfChart[perfChart.length - 1].time).getTime();
    const labels: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < COUNT; i++) {
      const target = t0 + (t1 - t0) * (i / (COUNT - 1));
      let nearest = perfChart[0];
      let minDiff = Infinity;
      for (const pt of perfChart) {
        const diff = Math.abs(new Date(pt.time).getTime() - target);
        if (diff < minDiff) { minDiff = diff; nearest = pt; }
      }
      const label = formatAxisLabel(nearest.time);
      labels.push(seen.has(label) ? "" : label);
      seen.add(label);
    }
    return labels;
  }, [perfChart]);

  // ── Allocation hover ───────────────────────────────────────────────────────
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const hoveredSeg = allocationRings.find((s) => s.symbol === hoveredSymbol) ?? null;

  // ── Hover ──────────────────────────────────────────────────────────────────
  const historyHover = useChartHover(historyValues.length);
  const perfHover = useChartHover(perfChart.length);

  // History hover — exact interpolated value and time at mouse position
  const hFrac = historyHover.hover?.fracIndex ?? null;
  const hValue = hFrac != null ? interpValue(historyValues, hFrac) : null;
  const hTime  = hFrac != null ? interpTime(filteredChart, hFrac) : null;
  const hDate  = hTime ? formatTooltipDate(hTime) : null;
  const hCrossX = historyHover.hover?.rawSvgX ?? null;

  // Performance hover — exact interpolated value and time at mouse position
  const pFrac   = perfHover.hover?.fracIndex ?? null;
  const pBtc    = pFrac != null && btcTrend ? interpValue(btcTrend, pFrac) : null;
  const pProfit = pFrac != null ? interpValue(allTimeProfitSeries, pFrac) : null;
  const pTime   = pFrac != null ? interpTime(perfChart, pFrac) : null;
  const pDate   = pTime ? formatTooltipDate(pTime) : null;
  const pCrossX = perfHover.hover?.rawSvgX ?? null;

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 md:gap-6 lg:mb-8 lg:grid-cols-[2fr_1fr]">

      {/* ── Holdings ──────────────────────────────────────────────────────── */}
      <article className="panel-base overflow-hidden p-5 sm:p-6">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h3 className="section-title shrink-0">Holdings</h3>
          <div className="flex flex-1 justify-end gap-2">
            {/* Timeframes — hidden on Allocation view */}
            {holdingsView === "History" && (
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
            )}
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

            {/* Y-axis labels — pinned to exact SVG grid-line positions */}
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
          <div className="flex h-72 items-center justify-center">
            <div className="flex items-center gap-10">
              {/* Donut */}
              <div className="relative h-44 w-44 shrink-0 text-(--surface-container-highest)">
                <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90 transform">
                  <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth="16" />
                  {allocationRings.map((seg) => (
                    <circle
                      key={seg.symbol}
                      cx="80" cy="80" r={radius}
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
                {/* Center label — shown on hover */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  {hoveredSeg != null ? (
                    <>
                      <span className="text-sm font-bold text-strong leading-tight">{hoveredSeg.label}</span>
                      <span className="text-xs text-muted mt-0.5">{hoveredSeg.normalizedPercent.toFixed(1)}%</span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Legend */}
              <div className="max-h-52 w-44 space-y-2.5 overflow-y-auto">
                {allocationRings.length === 0 && <div className="text-xs text-muted">No assets available</div>}
                {allocationRings.map((seg) => (
                  <div
                    key={seg.symbol}
                    className="flex items-center justify-between gap-3 transition-opacity duration-150"
                    style={{ opacity: hoveredSymbol != null && hoveredSymbol !== seg.symbol ? 0.3 : 1 }}
                    onMouseEnter={() => setHoveredSymbol(seg.symbol)}
                    onMouseLeave={() => setHoveredSymbol(null)}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                      <span className="truncate text-xs font-semibold text-strong">{seg.label}</span>
                    </div>
                    <span className="text-xs text-muted">{seg.normalizedPercent.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
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
          {btcTrend && (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: btcColor }} />
              <span className="text-muted">BTC trend</span>
            </div>
          )}
        </div>

        <ChartWrapper isLoading={!!isLoading} hasData={perfChart.length > 0} height="h-64">
        <div
          ref={perfHover.containerRef}
          className="relative h-64 cursor-crosshair select-none overflow-hidden rounded-xl bg-(--surface-container-low)"
          onMouseMove={perfHover.handleMouseMove}
          onMouseLeave={perfHover.handleMouseLeave}
        >
          <div className="absolute inset-0 pb-6 pr-14 pt-2">
          <svg
            ref={perfHover.svgRef}
            viewBox="0 0 100 50"
            preserveAspectRatio="none"
            className="h-full w-full overflow-visible"
          >
            {/* Horizontal grid lines at each tick */}
            {performanceTicks.map((tick, i) => {
              const y = svgY(tick, performanceRange);
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
            {/* 0 % reference line — highlighted so it stands out */}
            {zeroY >= 0 && zeroY <= CHART_BASELINE && (
              <line
                x1="0" y1={zeroY.toFixed(2)}
                x2="100" y2={zeroY.toFixed(2)}
                stroke="white"
                strokeOpacity="0.25"
                strokeWidth="0.6"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {/* BTC trend — orange benchmark line */}
            {btcPath && (
              <path d={btcPath} fill="none" style={{ stroke: btcColor }} strokeWidth={LINE_STROKE_WIDTH} vectorEffect="non-scaling-stroke" />
            )}
            {/* All-time profit — blue primary line, drawn on top */}
            <path d={profitPath} fill="none" style={{ stroke: profitColor }} strokeWidth={LINE_STROKE_WIDTH} vectorEffect="non-scaling-stroke" />
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
          </div>

          {/* Y-axis labels — pinned to exact SVG grid-line positions */}
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 pb-6 pt-2">
            <div className="relative h-full">
              {performanceTicks.map((tick, i) => (
                <span
                  key={i}
                  className="absolute right-1 -translate-y-1/2 text-right text-[10px] text-subtle"
                  style={{ top: `${(svgY(tick, performanceRange) / 50) * 100}%` }}
                >
                  {formatPercentTick(tick)}
                </span>
              ))}
            </div>
          </div>

          {/* Tooltip */}
          {perfHover.hover != null && pDate != null && (
            <div
              className="pointer-events-none absolute top-[50%] z-20 -translate-x-1/2 rounded-xl bg-(--surface-container-highest) px-3 py-2 shadow-xl ring-1 ring-white/10"
              style={{ left: perfHover.hover.tooltipLeftPx }}
            >
              <div className="mb-1 whitespace-nowrap text-[10px] font-semibold text-strong">{pDate.date}</div>
              <div className="mb-1.5 whitespace-nowrap text-[10px] text-muted">{pDate.time}</div>
              {pBtc != null && (
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: btcColor }} />
                  <span className="text-muted">BTC:</span>
                  <span className="font-semibold text-strong">{formatPercentTooltip(pBtc)}</span>
                </div>
              )}
              {pProfit != null && (
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: profitColor }} />
                  <span className="text-muted">All-time profit:</span>
                  <span className="font-semibold text-strong">{formatPercentTooltip(pProfit)}</span>
                </div>
              )}
            </div>
          )}

          {/* X-axis labels — always full history range, independent of Holdings timeframe */}
          <div className="absolute bottom-1 left-0 right-14 flex justify-between px-1 text-[10px] text-subtle">
            {perfChartLabels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
        </div>
        </ChartWrapper>
      </article>

    </section>
  );
}
