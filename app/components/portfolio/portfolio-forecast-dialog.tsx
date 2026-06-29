"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  PortfolioChartPoint,
  PortfolioForecast,
  PortfolioForecastPoint,
} from "@/app/lib/portfolio-types";
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
  tooltipTopPx: number;
  sectionLabel: "History" | "Forecast";
  label: string;
  value: string;
  band?: string;
  probabilityText?: string;
};

type GraphRange = {
  min: number;
  max: number;
  spread: number;
};

const SVG_WIDTH = 100;
const SVG_HEIGHT = 56;
const GRAPH_TOP = 6;
const GRAPH_BOTTOM = 48;
const HISTORY_WINDOW_DAYS = 5;
const HISTORY_SHARE = 0.56;
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
  text: "text-[#F0F4F8]",
  textMuted: "text-[#B7BDC6]",
  textSoft: "text-[#8C6A2A]",
  accent: "text-[#F0B90B]",
  accentBorder: "border-[#5C4615]",
  accentBg: "bg-[#2A2112]",
  accentStrong: "text-[#FFD86B]",
  positive: "text-[#F0B90B]",
  dangerText: "text-[#FF6B6B]",
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

function formatGeneratedTimestamp(time: string | null | undefined): string {
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

function buildRange(chart: PortfolioChartPoint[], forecast: PortfolioForecast | null): GraphRange {
  const values = chart.map((point) => point.totalValueUsd);
  if (forecast) {
    values.push(forecast.forecastLower, forecast.forecastUpper, forecast.forecastPortfolioValue);
    for (const point of forecast.percentilePathP10) values.push(point.valueUsd);
    for (const point of forecast.percentilePathP90) values.push(point.valueUsd);
    for (const path of forecast.samplePaths) {
      for (const point of path.points) {
        values.push(point.valueUsd);
      }
    }
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

function toValue(y: number, min: number, spread: number): number {
  const ratio = (GRAPH_BOTTOM - y) / (GRAPH_BOTTOM - GRAPH_TOP);
  return min + ratio * spread;
}

function buildHistoryPath(chart: PortfolioChartPoint[], min: number, spread: number): string {
  if (chart.length === 0) {
    return "";
  }

  return chart
    .map((point, index) => {
      const x = chart.length <= 1 ? HISTORY_END_X : (index / Math.max(chart.length - 1, 1)) * HISTORY_END_X;
      const y = toY(point.totalValueUsd, min, spread);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function forecastPointToSvg(point: PortfolioForecastPoint, horizonHours: number, min: number, spread: number) {
  const ratio = horizonHours > 0 ? point.hourOffset / horizonHours : 0;
  return {
    x: HISTORY_END_X + ratio * (FORECAST_END_X - HISTORY_END_X),
    y: toY(point.valueUsd, min, spread),
    hourOffset: point.hourOffset,
    valueUsd: point.valueUsd,
  };
}

function buildForecastPath(points: PortfolioForecastPoint[], horizonHours: number, min: number, spread: number): string {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => {
      const svgPoint = forecastPointToSvg(point, horizonHours, min, spread);
      return `${index === 0 ? "M" : "L"} ${svgPoint.x.toFixed(2)} ${svgPoint.y.toFixed(2)}`;
    })
    .join(" ");
}

function buildBandPath(
  lowerPoints: PortfolioForecastPoint[],
  upperPoints: PortfolioForecastPoint[],
  horizonHours: number,
  min: number,
  spread: number,
): string {
  if (lowerPoints.length === 0 || upperPoints.length === 0) {
    return "";
  }

  const upperPath = upperPoints
    .map((point, index) => {
      const svgPoint = forecastPointToSvg(point, horizonHours, min, spread);
      return `${index === 0 ? "M" : "L"} ${svgPoint.x.toFixed(2)} ${svgPoint.y.toFixed(2)}`;
    })
    .join(" ");

  const lowerPath = [...lowerPoints]
    .reverse()
    .map((point) => {
      const svgPoint = forecastPointToSvg(point, horizonHours, min, spread);
      return `L ${svgPoint.x.toFixed(2)} ${svgPoint.y.toFixed(2)}`;
    })
    .join(" ");

  return `${upperPath} ${lowerPath} Z`;
}

function findNearestPoint(points: PortfolioForecastPoint[], targetHourOffset: number): PortfolioForecastPoint | null {
  if (points.length === 0) {
    return null;
  }

  return points.reduce((best, point) =>
    Math.abs(point.hourOffset - targetHourOffset) < Math.abs(best.hourOffset - targetHourOffset) ? point : best,
  );
}

function findNearestDistribution(
  forecast: PortfolioForecast,
  targetHourOffset: number,
) {
  if (forecast.stepDistributions.length === 0) {
    return null;
  }

  return forecast.stepDistributions.reduce((best, distribution) =>
    Math.abs(distribution.hourOffset - targetHourOffset) < Math.abs(best.hourOffset - targetHourOffset)
      ? distribution
      : best,
  );
}

function estimateAtOrBelowProbability(sortedValues: number[], value: number): number | null {
  if (sortedValues.length === 0) {
    return null;
  }

  let low = 0;
  let high = sortedValues.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sortedValues[middle]! <= value) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return (low / sortedValues.length) * 100;
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
    const historyPoints = recentChart.map((point, index) => ({
      time: point.time,
      value: point.totalValueUsd,
      x: recentChart.length <= 1 ? HISTORY_END_X : (index / Math.max(recentChart.length - 1, 1)) * HISTORY_END_X,
      y: toY(point.totalValueUsd, range.min, range.spread),
    }));

    const p10Path = forecast
      ? buildForecastPath(forecast.percentilePathP10, forecast.horizonHours, range.min, range.spread)
      : "";
    const p25Path = forecast
      ? buildForecastPath(forecast.percentilePathP25, forecast.horizonHours, range.min, range.spread)
      : "";
    const p40Path = forecast
      ? buildForecastPath(forecast.percentilePathP40, forecast.horizonHours, range.min, range.spread)
      : "";
    const p50Path = forecast
      ? buildForecastPath(forecast.percentilePathP50, forecast.horizonHours, range.min, range.spread)
      : "";
    const p60Path = forecast
      ? buildForecastPath(forecast.percentilePathP60, forecast.horizonHours, range.min, range.spread)
      : "";
    const p75Path = forecast
      ? buildForecastPath(forecast.percentilePathP75, forecast.horizonHours, range.min, range.spread)
      : "";
    const p90Path = forecast
      ? buildForecastPath(forecast.percentilePathP90, forecast.horizonHours, range.min, range.spread)
      : "";
    const outerBandPath = forecast
      ? buildBandPath(
          forecast.percentilePathP10,
          forecast.percentilePathP90,
          forecast.horizonHours,
          range.min,
          range.spread,
        )
      : "";
    const middleBandPath = forecast
      ? buildBandPath(
          forecast.percentilePathP25,
          forecast.percentilePathP75,
          forecast.horizonHours,
          range.min,
          range.spread,
        )
      : "";
    const coreBandPath = forecast
      ? buildBandPath(
          forecast.percentilePathP40,
          forecast.percentilePathP60,
          forecast.horizonHours,
          range.min,
          range.spread,
        )
      : "";
    const samplePaths = forecast
      ? forecast.samplePaths.map((path) => ({
          label: path.label,
          svgPath: buildForecastPath(path.points, forecast.horizonHours, range.min, range.spread),
        }))
      : [];

    const historyTimeLabels =
      recentChart.length > 1
        ? [0, 1, 2].map((index) => {
            const pointIndex = Math.round((index / 2) * (recentChart.length - 1));
            const point = historyPoints[pointIndex]!;
            const date = new Date(recentChart[pointIndex]!.time);
            const label = Number.isNaN(date.getTime())
              ? ""
              : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
            return { xPct: (point.x / SVG_WIDTH) * 100, label };
          })
        : [];

    const forecastTimeLabels = forecast
      ? [0.25, 0.5, 0.75, 1].map((ratio) => ({
          xPct: HISTORY_SHARE * 100 + (1 - HISTORY_SHARE) * 100 * ratio,
          label: `+${Math.round(forecast.horizonHours * ratio)}h`,
        }))
      : [];

    return {
      range,
      historyPath,
      historyPoints,
      p10Path,
      p25Path,
      p40Path,
      p50Path,
      p60Path,
      p75Path,
      p90Path,
      outerBandPath,
      middleBandPath,
      coreBandPath,
      samplePaths,
      historyTimeLabels,
      forecastTimeLabels,
    };
  }, [chart, forecast]);

  const assetBreakdownRows = useMemo(
    () => [...(forecast?.assetBreakdown ?? [])].sort((left, right) => Math.abs(right.changeAbsUsd) - Math.abs(left.changeAbsUsd)),
    [forecast?.assetBreakdown],
  );
  const projectedDirectionTone =
    forecast && forecast.forecastChangeAbs >= 0 ? tone.positive : tone.dangerText;
  const generatedLabel = formatGeneratedTimestamp(forecast?.generatedAt);

  const updateHoverFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const container = chartAreaRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const ratioX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const ratioY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const svgX = ratioX * SVG_WIDTH;
      const svgY = ratioY * SVG_HEIGHT;
      const tooltipWidth = Math.min(272, rect.width - 24);
      const tooltipHeight = 132;
      const pointerOffsetX = 18;
      const pointerOffsetY = 18;
      const tooltipLeftPx = Math.max(
        tooltipWidth / 2,
        Math.min(rect.width - tooltipWidth / 2, clientX - rect.left + pointerOffsetX + tooltipWidth / 2),
      );
      const tooltipTopPx = Math.max(
        12,
        Math.min(rect.height - tooltipHeight - 12, clientY - rect.top + pointerOffsetY),
      );

      if (svgX > HISTORY_END_X && forecast) {
        const ratio = (svgX - HISTORY_END_X) / (FORECAST_END_X - HISTORY_END_X);
        const targetHourOffset = ratio * forecast.horizonHours;
        const p10Point = findNearestPoint(forecast.percentilePathP10, targetHourOffset);
        const p50Point = findNearestPoint(forecast.percentilePathP50, targetHourOffset);
        const p90Point = findNearestPoint(forecast.percentilePathP90, targetHourOffset);
        const distribution = findNearestDistribution(forecast, targetHourOffset);
        if (!p10Point || !p50Point || !p90Point) {
          setHoverState(null);
          return;
        }

        const hoveredValueUsd = toValue(svgY, graph.range.min, graph.range.spread);
        const clampedValueUsd = Math.max(
          Math.min(hoveredValueUsd, Math.max(p10Point.valueUsd, p90Point.valueUsd)),
          Math.min(p10Point.valueUsd, p90Point.valueUsd),
        );
        const atOrBelowProbability = distribution
          ? estimateAtOrBelowProbability(distribution.sortedValueUsd, clampedValueUsd)
          : null;

        setHoverState({
          tooltipLeftPx,
          tooltipTopPx,
          sectionLabel: "Forecast",
          label: `Forecast +${Math.round(p50Point.hourOffset)}h`,
          value: usdFormatter.format(clampedValueUsd),
          band: `${shortUsdFormatter.format(p10Point.valueUsd)} - ${shortUsdFormatter.format(p90Point.valueUsd)}`,
          probabilityText:
            atOrBelowProbability === null
              ? undefined
              : `Approx. ${atOrBelowProbability.toFixed(0)}% chance the portfolio ends at or below this level at that time.`,
        });
        return;
      }

      if (graph.historyPoints.length === 0) {
        setHoverState(null);
        return;
      }

      const closest = graph.historyPoints.reduce((best, point) =>
        Math.abs(point.x - svgX) < Math.abs(best.x - svgX) ? point : best,
      );
      setHoverState({
        tooltipLeftPx,
        tooltipTopPx,
        sectionLabel: "History",
        label: formatChartDate(closest.time),
        value: usdFormatter.format(closest.value),
      });
    },
    [forecast, graph.historyPoints, graph.range.max, graph.range.min, graph.range.spread],
  );

  const handleChartMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      updateHoverFromClient(event.clientX, event.clientY);
    },
    [updateHoverFromClient],
  );

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
      <div className={`flex max-h-[88vh] w-full max-w-[76rem] flex-col overflow-hidden rounded-[1.5rem] border shadow-[0_24px_80px_rgba(0,0,0,0.45)] ${tone.panel} ${tone.panelBorder}`}>
        <div className={`flex items-start justify-between gap-4 border-b px-5 py-4 ${tone.panelBorder}`}>
          <div className="space-y-2">
            <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.22em] ${tone.accent}`}>
              Portfolio forecast
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${tone.accentBorder} ${tone.accentBg} ${tone.accent}`}>
                Monte Carlo 48h
              </span>
              <span className={`text-xs ${tone.textMuted}`}>
                Generated: <span className="font-semibold text-white">{generatedLabel}</span>
              </span>
              {forecast?.simulationCount ? (
                <span className={`text-xs ${tone.textMuted}`}>
                  Simulations: <span className="font-semibold text-white">{forecast.simulationCount}</span>
                </span>
              ) : null}
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

        <div className="grid flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.78fr)]">
          <div className={`border-b px-5 py-5 lg:border-b-0 lg:border-r ${tone.panelBorder}`}>
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
                    : "Open forecast to run Monte Carlo simulation"}
                </p>
              </div>

              <div className="flex min-w-[18rem] flex-wrap items-start justify-end gap-x-4 gap-y-2 text-right">
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
              className="relative h-[19rem] sm:h-[21rem]"
              onMouseMove={handleChartMouseMove}
              onMouseLeave={() => setHoverState(null)}
            >
              <div className={`absolute inset-0 overflow-hidden rounded-[0.9rem] border bg-[#14181d] ${tone.panelBorder}`}>
                <div className="pointer-events-none absolute inset-x-3 top-3 z-[1] flex items-center justify-between text-[0.64rem] uppercase tracking-[0.16em]">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#F0B90B]" />
                    <span className={tone.textMuted}>Median path</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#F0B90B]/30" />
                      <span className={tone.textMuted}>P10-P90</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#F0B90B]/55" />
                      <span className={tone.textMuted}>P25-P75</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#FFE7A3]/80" />
                      <span className={tone.textMuted}>P40-P60</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-white/35" />
                      <span className={tone.textMuted}>Scenario paths</span>
                    </span>
                  </div>
                </div>

                <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} preserveAspectRatio="none" className="h-full w-full cursor-crosshair">
                  <defs>
                    <linearGradient id="forecast-history-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(240,185,11,0.22)" />
                      <stop offset="100%" stopColor="rgba(240,185,11,0.01)" />
                    </linearGradient>
                    <linearGradient id="forecast-mc-band" x1="56" y1="0" x2="100" y2="0">
                      <stop offset="0%" stopColor="rgba(240,185,11,0.08)" />
                      <stop offset="48%" stopColor="rgba(240,185,11,0.18)" />
                      <stop offset="100%" stopColor="rgba(240,185,11,0.32)" />
                    </linearGradient>
                    <linearGradient id="forecast-mc-band-mid" x1="56" y1="0" x2="100" y2="0">
                      <stop offset="0%" stopColor="rgba(240,185,11,0.12)" />
                      <stop offset="52%" stopColor="rgba(240,185,11,0.28)" />
                      <stop offset="100%" stopColor="rgba(240,185,11,0.46)" />
                    </linearGradient>
                    <linearGradient id="forecast-mc-band-core" x1="56" y1="0" x2="100" y2="0">
                      <stop offset="0%" stopColor="rgba(255,231,163,0.18)" />
                      <stop offset="55%" stopColor="rgba(255,231,163,0.36)" />
                      <stop offset="100%" stopColor="rgba(255,231,163,0.62)" />
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

                  <line
                    x1={HISTORY_END_X}
                    y1={GRAPH_TOP}
                    x2={HISTORY_END_X}
                    y2={GRAPH_BOTTOM}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="0.45"
                    vectorEffect="non-scaling-stroke"
                  />

                  {graph.historyPath ? (
                    <>
                      <path
                        d={`${graph.historyPath} L ${HISTORY_END_X.toFixed(2)} ${GRAPH_BOTTOM} L 0 ${GRAPH_BOTTOM} Z`}
                        fill="url(#forecast-history-fill)"
                        opacity="0.42"
                      />
                      <path
                        d={graph.historyPath}
                        fill="none"
                        stroke="rgba(240,185,11,0.9)"
                        strokeWidth="1.1"
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  ) : null}

                  {forecast ? (
                    <>
                      <path d={graph.outerBandPath} fill="url(#forecast-mc-band)" />
                      <path d={graph.middleBandPath} fill="url(#forecast-mc-band-mid)" />
                      <path d={graph.coreBandPath} fill="url(#forecast-mc-band-core)" />
                      <path
                        d={graph.p10Path}
                        fill="none"
                        stroke="rgba(240,185,11,0.28)"
                        strokeWidth="0.55"
                        strokeDasharray="1.6 2.2"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d={graph.p25Path}
                        fill="none"
                        stroke="rgba(240,185,11,0.20)"
                        strokeWidth="0.45"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d={graph.p40Path}
                        fill="none"
                        stroke="rgba(255,231,163,0.16)"
                        strokeWidth="0.4"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d={graph.p60Path}
                        fill="none"
                        stroke="rgba(255,231,163,0.16)"
                        strokeWidth="0.4"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d={graph.p75Path}
                        fill="none"
                        stroke="rgba(240,185,11,0.20)"
                        strokeWidth="0.45"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d={graph.p90Path}
                        fill="none"
                        stroke="rgba(240,185,11,0.28)"
                        strokeWidth="0.55"
                        strokeDasharray="1.6 2.2"
                        vectorEffect="non-scaling-stroke"
                      />
                      {graph.samplePaths.map((path, index) => (
                        <path
                          key={path.label}
                          d={path.svgPath}
                          fill="none"
                          stroke={index === 2 ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.18)"}
                          strokeWidth={index === 2 ? "0.55" : "0.45"}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                      <path
                        d={graph.p50Path}
                        fill="none"
                        stroke="rgba(255,240,185,0.92)"
                        strokeWidth="1.15"
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  ) : null}
                </svg>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 border-t border-white/[0.07]">
                  <div
                    className="absolute flex -translate-x-1/2 flex-col items-center"
                    style={{ left: `${HISTORY_SHARE * 100}%` }}
                  >
                    <div className="h-2 w-px bg-[#F0B90B]/50" />
                    <span className="mt-0.5 whitespace-nowrap text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-white/72">
                      Now
                    </span>
                  </div>
                  {graph.historyTimeLabels.map((label, index) => (
                    <div
                      key={index}
                      className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
                      style={{ left: `${label.xPct}%` }}
                    >
                      <div className="h-1.5 w-px bg-white/30" />
                      <span className="mt-0.5 whitespace-nowrap text-[0.6rem] font-semibold text-white/78">
                        {label.label}
                      </span>
                    </div>
                  ))}
                  {graph.forecastTimeLabels.map((label, index) => (
                    <div
                      key={index}
                      className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
                      style={{ left: `${label.xPct}%` }}
                    >
                      <div className="h-1.5 w-px bg-[#F0B90B]/40" />
                      <span className="mt-0.5 whitespace-nowrap text-[0.6rem] font-semibold text-white/70">
                        {label.label}
                      </span>
                    </div>
                  ))}
                </div>

              </div>

              {hoverState ? (
                <div
                  className="pointer-events-none absolute z-50 w-[min(17rem,calc(100%-1.5rem))] -translate-x-1/2 border-l border-[#F0B90B]/40 bg-[#111418]/92 px-3 py-2.5 text-[11px] shadow-[0_12px_32px_rgba(0,0,0,0.34)] backdrop-blur"
                  style={{ left: hoverState.tooltipLeftPx, top: hoverState.tooltipTopPx }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold uppercase tracking-[0.16em] text-[#F0B90B]/85">
                      {hoverState.sectionLabel}
                    </p>
                    {hoverState.band ? <p className="text-[#9CA3AF]">P10-P90 {hoverState.band}</p> : null}
                  </div>
                  <p className="mt-1 font-semibold text-white">{hoverState.label}</p>
                  <p className="mt-2 text-base font-semibold text-[#F0B90B]">{hoverState.value}</p>
                  {hoverState.probabilityText ? (
                    <p className="mt-2 text-[11px] leading-5 text-[#C9CED6]">{hoverState.probabilityText}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="space-y-5">
              <section className="space-y-3">
                <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.22em] ${tone.accent}`}>
                  Simulation notes
                </p>
                <div className="space-y-3 border-y border-white/6 py-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className={tone.textMuted}>Method</span>
                    <span className={`text-right font-semibold ${tone.text}`}>Historical Monte Carlo</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className={tone.textMuted}>Coverage</span>
                    <span className={`text-right font-semibold ${tone.text}`}>
                      {forecast ? `${forecast.coverageSummary.coveredValueRatio.toFixed(2)}%` : "-"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className={tone.textMuted}>Data window</span>
                    <span className={`text-right font-semibold ${tone.text}`}>
                      {forecast ? "30-day historical data" : "-"}
                    </span>
                  </div>
                  {forecast?.coverageSummary.uncoveredSymbols.length ? (
                    <div className="pt-1 text-xs text-[#E4B96A]">
                      Flat-value fallback used for: {forecast.coverageSummary.uncoveredSymbols.join(", ")}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="space-y-3">
                <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.22em] ${tone.accent}`}>
                  Asset contribution
                </p>
                <div className="divide-y divide-white/6 border-y border-white/6">
                  {assetBreakdownRows.length > 0 ? (
                    assetBreakdownRows.map((item) => (
                      <div key={item.symbol} className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className={`font-semibold ${tone.text}`}>{item.symbol}</p>
                          <p className={`shrink-0 text-sm font-semibold ${item.changeAbsUsd >= 0 ? tone.positive : tone.dangerText}`}>
                            {formatSignedCurrency(item.changeAbsUsd)}
                          </p>
                        </div>
                        <div className={`mt-1 flex items-center justify-between gap-3 text-xs ${tone.textMuted}`}>
                          <span>{item.predictedReturnPct >= 0 ? "+" : ""}{item.predictedReturnPct.toFixed(2)}%</span>
                          <span>Contribution {item.contributionPct.toFixed(2)}%</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={`py-4 text-sm ${tone.textMuted}`}>
                      {isForecastLoading
                        ? "Running Monte Carlo forecast..."
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
                  Simulating historical Monte Carlo paths...
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
