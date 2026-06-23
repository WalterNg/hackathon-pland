"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PortfolioChartPoint, PortfolioForecast } from "@/app/lib/portfolio-types";
import { MaterialIcon } from "../dashboard/material-icon";

type PortfolioForecastDialogProps = {
  open: boolean;
  onClose: () => void;
  chart: PortfolioChartPoint[];
  forecast: PortfolioForecast | null;
  forecastError: string | null;
  isForecastLoading: boolean;
  onRefreshForecast: () => void;
};

type ForecastHoverState = {
  tooltipLeftPx: number;
  /** true = anchor to bottom of dot (show above), false = anchor to top (show below), null = fixed top-14 */
  tooltipAbove: boolean | null;
  x: number;
  y: number;
  sectionLabel: string;
  label: string;
  value: string;
  band?: string;
  projectedPnl?: string;
  projectedReturn?: string;
  confidence?: string;
};

const SVG_WIDTH = 100;
const SVG_HEIGHT = 56;
const GRAPH_TOP = 6;
const GRAPH_BOTTOM = 48;
const HISTORY_WINDOW_DAYS = 5;
const HISTORY_SHARE = 0.6;
const HISTORY_END_X = SVG_WIDTH * HISTORY_SHARE;
const FORECAST_END_X = SVG_WIDTH;
const HISTORY_WINDOW_MS = HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const shortUsdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const tooltipTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const tone = {
  panel: "bg-[#181A20]",
  panelBorder: "border-[#2B3139]",
  surface: "bg-[#1E2329]",
  surfaceMuted: "bg-[#181A20]",
  surfaceStrong: "bg-[#2B2418]",
  text: "text-[#F0F4F8]",
  textMuted: "text-[#B7BDC6]",
  textSoft: "text-[#8C6A2A]",
  accent: "text-[#F0B90B]",
  accentStrong: "text-[#F0B90B]",
  accentBorder: "border-[#5C4615]",
  accentBg: "bg-[#2A2112]",
  dangerText: "text-[#FF6B6B]",
  dangerBg: "bg-[#2A1717]",
  dangerBorder: "border-[#5B2A2A]",
};

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignedCurrency(value: number): string {
  return `${value >= 0 ? "+" : "-"}${usdFormatter.format(Math.abs(value))}`;
}

function formatChartDate(time: string): string {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) {
    return time;
  }

  return `${tooltipDateFormatter.format(date)} - ${tooltipTimeFormatter.format(date)}`;
}

function formatArtifactTimestamp(time: string | null | undefined): string {
  if (!time) {
    return "-";
  }

  const date = new Date(time);
  if (Number.isNaN(date.getTime())) {
    return time;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatConfidenceLabel(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  if (value >= 8) {
    return "High confidence";
  }

  if (value >= 5) {
    return "Moderate confidence";
  }

  return "Cautious signal";
}

function buildRange(chart: PortfolioChartPoint[], forecast: PortfolioForecast | null) {
  const values = chart.map((point) => point.totalValueUsd);
  if (forecast) {
    values.push(forecast.forecastLower, forecast.forecastUpper, forecast.forecastPortfolioValue);
  }

  if (values.length === 0) {
    return { min: 0, max: 1, spread: 1 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  const pad = spread * 0.08;
  const bottom = Math.max(0, min - pad);
  const top = max + pad;

  return {
    min: bottom,
    max: top,
    spread: Math.max(top - bottom, 1),
  };
}

function toY(value: number, min: number, spread: number): number {
  return GRAPH_BOTTOM - ((value - min) / spread) * (GRAPH_BOTTOM - GRAPH_TOP);
}

function getRecentHistoryWindow(chart: PortfolioChartPoint[]): PortfolioChartPoint[] {
  if (chart.length <= 1) {
    return chart;
  }

  const latestTimeMs = new Date(chart[chart.length - 1]!.time).getTime();
  if (Number.isNaN(latestTimeMs)) {
    return chart;
  }

  const cutoff = latestTimeMs - HISTORY_WINDOW_MS;
  const visiblePoints = chart.filter((point) => new Date(point.time).getTime() >= cutoff);
  const lastBeforeCutoff = [...chart].reverse().find((point) => new Date(point.time).getTime() < cutoff);

  return lastBeforeCutoff ? [lastBeforeCutoff, ...visiblePoints] : visiblePoints;
}

function buildHistoryPath(chart: PortfolioChartPoint[], min: number, spread: number): string {
  if (chart.length === 0) {
    return "";
  }

  if (chart.length === 1) {
    const y = toY(chart[0].totalValueUsd, min, spread);
    return `M 0 ${y.toFixed(2)} L ${HISTORY_END_X.toFixed(2)} ${y.toFixed(2)}`;
  }

  return chart
    .map((point, index) => {
      const x = (index / Math.max(chart.length - 1, 1)) * HISTORY_END_X;
      const y = toY(point.totalValueUsd, min, spread);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildConePath(lastY: number, upperY: number, lowerY: number): string {
  return `M ${HISTORY_END_X.toFixed(2)} ${lastY.toFixed(2)} L ${FORECAST_END_X.toFixed(2)} ${upperY.toFixed(2)} L ${FORECAST_END_X.toFixed(2)} ${lowerY.toFixed(2)} Z`;
}

function buildHorizontalPath(y: number): string {
  return `M 0 ${y.toFixed(2)} L ${SVG_WIDTH.toFixed(2)} ${y.toFixed(2)}`;
}

function buildForecastWavyPath(lastY: number, forecastY: number, upperY: number, lowerY: number): string {
  // 5 waypoints; last offset = 0 so path ends exactly at forecastY
  const normalizedOffsets = [0.38, -0.45, 0.42, -0.22, 0];
  const numSegments = normalizedOffsets.length;

  // Build the raw waypoints
  const pts: Array<{ x: number; y: number }> = [{ x: HISTORY_END_X, y: lastY }];
  for (let i = 0; i < numSegments; i++) {
    const t = (i + 1) / numSegments;
    const x = HISTORY_END_X + t * (FORECAST_END_X - HISTORY_END_X);
    const trendY = lastY + (forecastY - lastY) * t;
    const bandTop = lastY + t * (upperY - lastY);
    const bandBottom = lastY + t * (lowerY - lastY);
    const halfBand = Math.abs(bandBottom - bandTop) * 0.4;
    const dampening = Math.pow(1 - t, 0.5);
    const y = Math.max(
      GRAPH_TOP + 0.5,
      Math.min(GRAPH_BOTTOM - 0.5, trendY + normalizedOffsets[i] * halfBand * dampening),
    );
    pts.push({ x, y });
  }

  // Smooth with cubic bezier — control points are 1/3 and 2/3 between neighbours
  let path = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cp1x = prev.x + (curr.x - prev.x) / 3;
    const cp1y = prev.y;
    const cp2x = curr.x - (curr.x - prev.x) / 3;
    const cp2y = curr.y;
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
  }

  return path;
}

export function PortfolioForecastDialog({
  open,
  onClose,
  chart,
  forecast,
  forecastError,
  isForecastLoading,
  onRefreshForecast,
}: PortfolioForecastDialogProps) {
  const [hoverState, setHoverState] = useState<ForecastHoverState | null>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const graph = useMemo(() => {
    const recentChart = getRecentHistoryWindow(chart);
    const range = buildRange(recentChart, forecast);
    const historyPath = buildHistoryPath(recentChart, range.min, range.spread);
    const lastValue = recentChart[recentChart.length - 1]?.totalValueUsd ?? 0;
    const lastY = toY(lastValue, range.min, range.spread);
    const forecastY = forecast ? toY(forecast.forecastPortfolioValue, range.min, range.spread) : lastY;
    const upperY = forecast ? toY(forecast.forecastUpper, range.min, range.spread) : lastY;
    const lowerY = forecast ? toY(forecast.forecastLower, range.min, range.spread) : lastY;
    const historyPoints = recentChart.map((point, index) => ({
      time: point.time,
      value: point.totalValueUsd,
      x: recentChart.length <= 1 ? 0 : (index / Math.max(recentChart.length - 1, 1)) * HISTORY_END_X,
      y: toY(point.totalValueUsd, range.min, range.spread),
    }));

    // Y-axis: 4 evenly spaced price labels
    const yLabels = [0, 1, 2, 3].map((i) => {
      const value = range.max - (i / 3) * (range.max - range.min);
      return { value, yPct: (toY(value, range.min, range.spread) / SVG_HEIGHT) * 100 };
    });

    // X-axis history: 3 evenly spaced time labels
    const historyTimeLabels =
      recentChart.length > 1
        ? [0, 1, 2].map((i) => {
            const idx = Math.round((i / 2) * (recentChart.length - 1));
            const pt = historyPoints[idx]!;
            const d = new Date(recentChart[idx]!.time);
            const label = Number.isNaN(d.getTime())
              ? ""
              : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
            return { xPct: (pt.x / SVG_WIDTH) * 100, label };
          })
        : [];

    // X-axis forecast: +⅓h, +⅔h, end
    const forecastTimeLabels = forecast
      ? [0.33, 0.67, 1.0].map((ratio) => ({
          xPct: HISTORY_SHARE * 100 + (1 - HISTORY_SHARE) * 100 * ratio,
          label: `+${Math.round(forecast.horizonHours * ratio)}h`,
        }))
      : [];

    return {
      historyPoints,
      historyPath,
      lastY,
      forecastY,
      upperY,
      lowerY,
      lastValue,
      conePath: buildConePath(lastY, upperY, lowerY),
      currentReferencePath: buildHorizontalPath(lastY),
      forecastReferencePath: forecast ? buildHorizontalPath(forecastY) : "",
      downsideReferencePath: forecast ? buildHorizontalPath(lowerY) : "",
      yLabels,
      historyTimeLabels,
      forecastTimeLabels,
    };
  }, [chart, forecast]);

  const topBreakdown = (forecast?.assetBreakdown ?? []).slice(0, 5);
  const projectedBandWidth = forecast ? forecast.forecastUpper - forecast.forecastLower : null;
  const projectedDirectionTone =
    forecast && forecast.forecastChangeAbs >= 0 ? tone.accentStrong : tone.dangerText;
  const confidenceLabel = formatConfidenceLabel(forecast?.confidenceScore);
  const artifactLabel = formatArtifactTimestamp(forecast?.artifactTimestamp);

  const metricCards = [
    {
      label: "Horizon",
      value: forecast ? `${forecast.horizonHours} hours` : "-",
      toneClass: tone.text,
      supporting: "Forecast window",
    },
    {
      label: "Confidence",
      value: forecast ? `${forecast.confidenceScore}/10` : "-",
      toneClass: tone.text,
      supporting: confidenceLabel,
    },
    {
      label: "Projected move",
      value: forecast ? formatSignedPercent(forecast.forecastChangePct) : "-",
      toneClass: projectedDirectionTone,
      supporting: forecast ? formatSignedCurrency(forecast.forecastChangeAbs) : "No projection",
    },
    {
      label: "Band width",
      value: projectedBandWidth != null ? usdFormatter.format(projectedBandWidth) : "-",
      toneClass: tone.text,
      supporting: "Low to high range",
    },
  ];

  const updateHoverFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const container = chartAreaRef.current;
      if (!container || graph.historyPoints.length === 0) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const ratioX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const ratioY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const svgX = ratioX * SVG_WIDTH;
      const svgY = ratioY * SVG_HEIGHT;
      const tooltipLeftPx = Math.max(104, Math.min(rect.width - 104, clientX - rect.left));

      // Forecast zone: only activate when mouse is inside the fan cone
      if (svgX > HISTORY_END_X && forecast) {
        const t = (svgX - HISTORY_END_X) / (FORECAST_END_X - HISTORY_END_X);
        const fanTop = Math.min(
          graph.lastY + t * (graph.upperY - graph.lastY),
          graph.lastY + t * (graph.lowerY - graph.lastY),
        );
        const fanBottom = Math.max(
          graph.lastY + t * (graph.upperY - graph.lastY),
          graph.lastY + t * (graph.lowerY - graph.lastY),
        );
        const HIT_TOLERANCE = 4; // SVG units

        const inFan = svgY >= fanTop - HIT_TOLERANCE && svgY <= fanBottom + HIT_TOLERANCE;

        if (inFan) {
          const forecastTooltipLeft = Math.round(rect.width * 0.28);
          setHoverState({
            tooltipLeftPx: forecastTooltipLeft,
            tooltipAbove: null,
            x: FORECAST_END_X,
            y: graph.forecastY,
            sectionLabel: "Forecast",
            label: "Forecast +48h",
            value: usdFormatter.format(forecast.forecastPortfolioValue),
            band: `${shortUsdFormatter.format(forecast.forecastLower)} - ${shortUsdFormatter.format(forecast.forecastUpper)}`,
            projectedPnl: formatSignedCurrency(forecast.forecastChangeAbs),
            projectedReturn: formatSignedPercent(forecast.forecastChangePct),
            confidence: `${forecast.confidenceScore}/10`,
          });
          return;
        }

        // Mouse in forecast X zone but outside fan — clear tooltip
        setHoverState(null);
        return;
      }

      // History zone
      const closest = graph.historyPoints.reduce((best, point) =>
        Math.abs(point.x - svgX) < Math.abs(best.x - svgX) ? point : best,
      );

      setHoverState({
        tooltipLeftPx,
        tooltipAbove: null,
        x: closest.x,
        y: closest.y,
        sectionLabel: "History",
        label: formatChartDate(closest.time),
        value: usdFormatter.format(closest.value),
      });
    },
    [forecast, graph],
  );

  const handleChartMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      updateHoverFromClient(event.clientX, event.clientY);
    },
    [updateHoverFromClient],
  );

  const handleChartMouseLeave = useCallback(() => {
    setHoverState(null);
  }, []);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/62 p-3 backdrop-blur-sm sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={`flex max-h-[88vh] w-full max-w-[72rem] flex-col overflow-hidden rounded-[1.5rem] border shadow-[0_24px_80px_rgba(0,0,0,0.45)] ${tone.panel} ${tone.panelBorder}`}>
        <div className={`flex items-start justify-between gap-4 border-b px-5 py-4 ${tone.panelBorder}`}>
          <div className="space-y-2">
            <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.22em] ${tone.accent}`}>
              Portfolio forecast
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${tone.accentBorder} ${tone.accentBg} ${tone.accent}`}>
                48h outlook
              </span>
              <span className={`text-xs ${tone.textMuted}`}>
                Based on the latest portfolio composition and saved model artifact.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshForecast}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition hover:bg-[#34280f] ${tone.accentBorder} ${tone.accentBg} ${tone.accentStrong}`}
            >
              <MaterialIcon name="refresh" outlined={false} className="text-sm" />
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-[#242931] ${tone.textMuted} hover:text-white`}
              aria-label="Close forecast dialog"
            >
              <MaterialIcon name="close" outlined={false} className="text-xl" />
            </button>
          </div>
        </div>

        <div className="grid flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.82fr)]">
          <div className={`border-b px-5 py-5 lg:border-b-0 lg:border-r ${tone.panelBorder}`}>
            <div className={`p-1 sm:p-2`}>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${tone.textSoft}`}>
                    Projected portfolio value
                  </p>
                  <p className={`text-xl font-semibold sm:text-2xl ${tone.text}`}>
                    {forecast ? usdFormatter.format(forecast.forecastPortfolioValue) : "Forecast unavailable"}
                  </p>
                  <p className={`text-sm font-medium ${projectedDirectionTone}`}>
                    {forecast
                      ? `${formatSignedCurrency(forecast.forecastChangeAbs)} (${formatSignedPercent(forecast.forecastChangePct)})`
                      : "No projection available"}
                  </p>
                  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${tone.textMuted}`}>
                    <span>Artifact: {artifactLabel}</span>
                    <span className="text-white/14">/</span>
                    <span>Confidence: {confidenceLabel}</span>
                  </div>
                </div>

                <div className={`flex min-w-[18rem] flex-wrap items-start justify-end gap-x-4 gap-y-2 text-right`}>
                  <div className="min-w-[5.5rem]">
                    <p className={`text-[0.62rem] uppercase tracking-[0.16em] ${tone.textSoft}`}>Downside P10</p>
                    <p className={`mt-1 text-sm font-semibold ${tone.text}`}>
                      {forecast ? usdFormatter.format(forecast.forecastLower) : "-"}
                    </p>
                  </div>
                  <div className="h-9 w-px self-center bg-white/8" />
                  <div className="min-w-[5.5rem]">
                    <p className={`text-[0.62rem] uppercase tracking-[0.16em] ${tone.textSoft}`}>Base P50</p>
                    <p className={`mt-1 text-sm font-semibold ${tone.text}`}>
                      {forecast ? usdFormatter.format(forecast.forecastPortfolioValue) : "-"}
                    </p>
                  </div>
                  <div className="h-9 w-px self-center bg-white/8" />
                  <div className="min-w-[5.5rem]">
                    <p className={`text-[0.62rem] uppercase tracking-[0.16em] ${tone.textSoft}`}>Upside P90</p>
                    <p className={`mt-1 text-sm font-semibold ${tone.text}`}>
                      {forecast ? usdFormatter.format(forecast.forecastUpper) : "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div
                ref={chartAreaRef}
                className={`relative h-[18rem] sm:h-[20rem]`}
                onMouseMove={handleChartMouseMove}
                onMouseLeave={handleChartMouseLeave}
              >
                {/* Inner clipped area: SVG + labels — tooltip stays OUTSIDE so it's never clipped */}
                <div className={`absolute inset-0 overflow-hidden rounded-[0.9rem] bg-[#171a1f]/72 border ${tone.panelBorder}`}>
                <div className="pointer-events-none absolute inset-x-3 top-3 z-[1] flex items-center justify-between text-[0.64rem] uppercase tracking-[0.16em]">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#F0B90B]" />
                    <span className={tone.textMuted}>Portfolio path</span>
                  </div>
                  {forecast ? (
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#F0B90B]/60" />
                      <span className={tone.textMuted}>P10-P90 forecast band</span>
                    </div>
                  ) : null}
                </div>

                <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} preserveAspectRatio="none" className="h-full w-full cursor-crosshair">
                  <defs>
                    <linearGradient id="forecast-history-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(240,185,11,0.24)" />
                      <stop offset="100%" stopColor="rgba(240,185,11,0.01)" />
                    </linearGradient>
                    <linearGradient id="forecast-cone-fill" x1="66.67" y1="0" x2="100" y2="0">
                      <stop offset="0%" stopColor="rgba(240,185,11,0.12)" />
                      <stop offset="100%" stopColor="rgba(240,185,11,0.28)" />
                    </linearGradient>
                  </defs>

                  {[0, 1, 2, 3, 4].map((index) => {
                    const y = GRAPH_TOP + ((GRAPH_BOTTOM - GRAPH_TOP) / 4) * index;
                    return (
                      <line
                        key={index}
                        x1="0"
                        y1={y}
                        x2={SVG_WIDTH}
                        y2={y}
                        stroke="rgba(255,255,255,0.07)"
                        strokeWidth="0.35"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}

                  <path
                    d={graph.currentReferencePath}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="0.45"
                    strokeDasharray="2.6 2"
                    vectorEffect="non-scaling-stroke"
                  />

                  {forecast ? (
                    <>
                      <path
                        d={graph.forecastReferencePath}
                        fill="none"
                        stroke="rgba(240,185,11,0.16)"
                        strokeWidth="0.45"
                        strokeDasharray="2.4 2.2"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d={graph.downsideReferencePath}
                        fill="none"
                        stroke="rgba(240,185,11,0.1)"
                        strokeWidth="0.4"
                        strokeDasharray="1.8 2.4"
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  ) : null}

                  <line
                    x1={HISTORY_END_X}
                    y1={GRAPH_TOP}
                    x2={HISTORY_END_X}
                    y2={GRAPH_BOTTOM}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="0.45"
                    vectorEffect="non-scaling-stroke"
                  />

                  {graph.historyPath ? (
                    <>
                      <path
                        d={`${graph.historyPath} L ${HISTORY_END_X.toFixed(2)} ${GRAPH_BOTTOM} L 0 ${GRAPH_BOTTOM} Z`}
                        fill="url(#forecast-history-fill)"
                        opacity="0.45"
                      />
                      <path
                        d={graph.historyPath}
                        fill="none"
                        stroke="rgba(240,185,11,0.95)"
                        strokeWidth="1.15"
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  ) : null}

                  {forecast ? (
                    <>
                      <path d={graph.conePath} fill="url(#forecast-cone-fill)" />
                      <line
                        x1={HISTORY_END_X}
                        y1={graph.lastY}
                        x2={FORECAST_END_X}
                        y2={graph.upperY}
                        stroke="rgba(240,185,11,0.26)"
                        strokeWidth="0.55"
                        strokeDasharray="1.5 1.8"
                        vectorEffect="non-scaling-stroke"
                      />
                      <line
                        x1={HISTORY_END_X}
                        y1={graph.lastY}
                        x2={FORECAST_END_X}
                        y2={graph.lowerY}
                        stroke="rgba(240,185,11,0.26)"
                        strokeWidth="0.55"
                        strokeDasharray="1.5 1.8"
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle cx={HISTORY_END_X} cy={graph.lastY} r="0.9" fill="rgba(240,185,11,1)" />
                      <circle cx={FORECAST_END_X} cy={graph.forecastY} r="1.1" fill="rgba(240,185,11,1)" />
                    </>
                  ) : null}

                  {hoverState ? (
                    <>
                      <line
                        x1={hoverState.x}
                        y1={GRAPH_TOP}
                        x2={hoverState.x}
                        y2={GRAPH_BOTTOM}
                        stroke="rgba(240,185,11,0.42)"
                        strokeWidth="0.55"
                        strokeDasharray="1.5 1.8"
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle
                        cx={hoverState.x}
                        cy={hoverState.y}
                        r="1.1"
                        fill="rgba(240,185,11,1)"
                        stroke="rgba(24,26,32,1)"
                        strokeWidth="0.45"
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  ) : null}
                </svg>

                {/* ── X time axis ─────────────────────────────────── */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 border-t border-white/[0.07]">
                  {/* NOW tick */}
                  <div
                    className="absolute flex -translate-x-1/2 flex-col items-center"
                    style={{ left: `${HISTORY_SHARE * 100}%` }}
                  >
                    <div className="h-1.5 w-px bg-[#F0B90B]/50" />
                  </div>
                  {/* History time ticks */}
                  {graph.historyTimeLabels.map((lbl, i) => (
                    <div
                      key={i}
                      className="absolute flex -translate-x-1/2 flex-col items-center"
                      style={{ left: `${lbl.xPct}%` }}
                    >
                      <div className="h-1.5 w-px bg-white/30" />
                      <span className="mt-0.5 whitespace-nowrap text-[0.62rem] font-semibold text-white/80">{lbl.label}</span>
                    </div>
                  ))}
                  {/* Forecast relative-time ticks */}
                  {graph.forecastTimeLabels.map((lbl, i) => (
                    <div
                      key={i}
                      className="absolute flex -translate-x-1/2 flex-col items-center"
                      style={{ left: `${lbl.xPct}%` }}
                    >
                      <div className="h-1.5 w-px bg-[#F0B90B]/40" />
                      <span className="mt-0.5 whitespace-nowrap text-[0.62rem] font-semibold text-white/70">{lbl.label}</span>
                    </div>
                  ))}
                </div>

                {/* ── Y value axis (right) ─────────────────────────── */}
                <div className="pointer-events-none absolute right-0 top-0 bottom-7 w-12">
                  {graph.yLabels.map((lbl, i) => (
                    <div
                      key={i}
                      className="absolute right-2 -translate-y-1/2 text-right font-mono text-[0.62rem] font-semibold leading-none text-white/75"
                      style={{ top: `${lbl.yPct}%` }}
                    >
                      {shortUsdFormatter.format(lbl.value)}
                    </div>
                  ))}
                </div>
                </div>{/* end inner clipped div */}

                {hoverState ? (
                  <div
                    className="pointer-events-none absolute z-50 w-[min(16rem,calc(100%-1.5rem))] -translate-x-1/2 border-l border-[#F0B90B]/40 bg-[#111418]/92 px-3 py-2.5 text-[11px] shadow-[0_12px_32px_rgba(0,0,0,0.34)] backdrop-blur"
                    style={{
                      left: hoverState.tooltipLeftPx,
                      ...(hoverState.tooltipAbove === null
                        ? { top: "0.75rem" }
                        : hoverState.tooltipAbove
                          ? { bottom: `calc(${((SVG_HEIGHT - hoverState.y) / SVG_HEIGHT) * 100}% + 10px)` }
                          : { top: `calc(${(hoverState.y / SVG_HEIGHT) * 100}% + 10px)` }),
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold uppercase tracking-[0.16em] text-[#F0B90B]/85">
                        {hoverState.sectionLabel}
                      </p>
                      {hoverState.band ? <p className="text-[#9CA3AF]">P10-P90 {hoverState.band}</p> : null}
                    </div>
                    <p className="mt-1 font-semibold text-white">{hoverState.label}</p>
                    <p className="mt-2 text-base font-semibold text-[#F0B90B]">{hoverState.value}</p>
                    {hoverState.band ? (
                      <div className="mt-3 space-y-1 border-t border-white/6 pt-2 text-[11px] text-[#B7BDC6]">
                        <div className="flex items-center justify-between gap-3">
                          <span>Downside P10</span>
                          <span>{forecast ? shortUsdFormatter.format(forecast.forecastLower) : "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Base P50</span>
                          <span>{forecast ? shortUsdFormatter.format(forecast.forecastPortfolioValue) : "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Upside P90</span>
                          <span>{forecast ? shortUsdFormatter.format(forecast.forecastUpper) : "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Projected P&amp;L</span>
                          <span>{hoverState.projectedPnl ?? "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Projected return</span>
                          <span>{hoverState.projectedReturn ?? "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Confidence</span>
                          <span>{hoverState.confidence ?? "-"}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="space-y-5">
              <section className="space-y-3">
                <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${tone.textSoft}`}>
                  Forecast metrics
                </p>
                <div className="divide-y divide-white/6 border-y border-white/6">
                  {metricCards.map((metric) => (
                    <div
                      key={metric.label}
                      className="flex items-start justify-between gap-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.16em] ${tone.textSoft}`}>
                          {metric.label}
                        </p>
                        <p className={`mt-1 text-xs ${tone.textMuted}`}>{metric.supporting}</p>
                      </div>
                      <p className={`shrink-0 text-right text-base font-semibold ${metric.toneClass}`}>
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-white/6 pt-3 text-sm">
                  <span className={tone.textMuted}>Artifact timestamp</span>
                  <span className={`text-right font-semibold ${tone.text}`}>{artifactLabel}</span>
                </div>
              </section>

              <section className="space-y-3">
                <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${tone.textSoft}`}>
                  Asset contribution
                </p>
                <div className="divide-y divide-white/6 border-y border-white/6">
                  {topBreakdown.length > 0 ? (
                    topBreakdown.map((item) => (
                      <div key={item.symbol} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`font-semibold ${tone.text}`}>{item.symbol}</p>
                            <p className={`mt-1 text-xs ${tone.textSoft}`}>
                              Projected return {item.predictedReturnPct.toFixed(2)}%
                            </p>
                          </div>
                          <p className={`shrink-0 text-sm font-semibold ${item.changeAbsUsd >= 0 ? tone.accentStrong : tone.dangerText}`}>
                            {formatSignedCurrency(item.changeAbsUsd)}
                          </p>
                        </div>
                        <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${tone.textMuted}`}>
                          <span>Contribution {item.contributionPct.toFixed(2)}%</span>
                          <span className="text-white/14">/</span>
                          <span>Forecast value {usdFormatter.format(item.forecastValueUsd)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={`py-4 text-sm ${tone.textMuted}`}>
                      {isForecastLoading
                        ? "Loading forecast details..."
                        : forecastError || "No asset contribution data available."}
                    </div>
                  )}
                </div>
              </section>

              {forecastError ? (
                <div className={`border-l border-[#5B2A2A] pl-3 text-sm ${tone.dangerText}`}>
                  <div className="flex items-center gap-2 font-semibold">
                    <MaterialIcon name="warning" outlined={false} className="text-sm" />
                    Forecast unavailable
                  </div>
                  <p className="mt-1">{forecastError}</p>
                </div>
              ) : null}

              {isForecastLoading ? (
                <div className={`border-l border-[#5C4615] pl-3 text-sm ${tone.textMuted}`}>
                  Updating forecast from the latest artifact...
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
