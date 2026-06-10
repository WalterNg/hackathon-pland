"use client";

import { useCallback, useMemo, useRef, useState } from "react";

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

const SVG_WIDTH = 100;
const SVG_HEIGHT = 56;
const GRAPH_TOP = 6;
const GRAPH_BOTTOM = 48;
const HISTORY_WINDOW_DAYS = 5;
const HISTORY_SHARE = 2 / 3;
const FORECAST_SHARE = 1 / 3;
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

type ForecastHoverState = {
  tooltipLeftPx: number;
  x: number;
  y: number;
  label: string;
  value: string;
  band?: string;
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

  return `${tooltipDateFormatter.format(date)} · ${tooltipTimeFormatter.format(date)}`;
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

function buildForecastLine(lastY: number, forecastY: number): string {
  return `M ${HISTORY_END_X.toFixed(2)} ${lastY.toFixed(2)} L ${FORECAST_END_X.toFixed(2)} ${forecastY.toFixed(2)}`;
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

    return {
      range,
      recentChart,
      historyPoints,
      historyPath,
      lastY,
      forecastY,
      upperY,
      lowerY,
      conePath: buildConePath(lastY, upperY, lowerY),
      forecastPath: buildForecastLine(lastY, forecastY),
    };
  }, [chart, forecast]);

  const topBreakdown = (forecast?.assetBreakdown ?? []).slice(0, 5);

  const updateHoverFromClientX = useCallback(
    (clientX: number) => {
      const container = chartAreaRef.current;
      if (!container || graph.historyPoints.length === 0) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const svgX = ratio * SVG_WIDTH;
      const tooltipLeftPx = Math.max(88, Math.min(rect.width - 88, clientX - rect.left));

      if (svgX <= HISTORY_END_X || !forecast) {
        const closest = graph.historyPoints.reduce((best, point) =>
          Math.abs(point.x - svgX) < Math.abs(best.x - svgX) ? point : best,
        );

        setHoverState({
          tooltipLeftPx,
          x: closest.x,
          y: closest.y,
          label: formatChartDate(closest.time),
          value: usdFormatter.format(closest.value),
        });
        return;
      }

      setHoverState({
        tooltipLeftPx,
        x: FORECAST_END_X,
        y: graph.forecastY,
        label: "Forecast +48h",
        value: usdFormatter.format(forecast.forecastPortfolioValue),
        band: `${shortUsdFormatter.format(forecast.forecastLower)} - ${shortUsdFormatter.format(forecast.forecastUpper)}`,
      });
    },
    [forecast, graph.forecastY, graph.historyPoints],
  );

  const handleChartMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      updateHoverFromClientX(event.clientX);
    },
    [updateHoverFromClientX],
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
          <div>
            <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.22em] ${tone.accent}`}>
              Portfolio forecast
            </p>
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

        <div className="grid flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.78fr)]">
          <div className={`border-b px-5 py-5 lg:border-b-0 lg:border-r ${tone.panelBorder}`}>
            <div className={`rounded-[1.2rem] border p-4 ${tone.surface} ${tone.panelBorder}`}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${tone.textSoft}`}>
                    Forecast chart
                  </p>
                  <p className={`mt-2 text-xl font-semibold sm:text-2xl ${tone.text}`}>
                    {forecast ? usdFormatter.format(forecast.forecastPortfolioValue) : "Forecast unavailable"}
                  </p>
                  <p
                    className={`mt-1 text-sm font-medium ${
                      forecast && forecast.forecastChangeAbs >= 0 ? tone.accentStrong : tone.dangerText
                    }`}
                  >
                    {forecast ? `${formatSignedCurrency(forecast.forecastChangeAbs)} (${formatSignedPercent(forecast.forecastChangePct)})` : "No projection available"}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-right">
                  <div className={`rounded-[1rem] border px-3 py-2 ${tone.surfaceMuted} ${tone.panelBorder}`}>
                    <p className={`text-[0.62rem] uppercase tracking-[0.16em] ${tone.textSoft}`}>Low</p>
                    <p className={`mt-1 text-sm font-semibold ${tone.text}`}>{forecast ? usdFormatter.format(forecast.forecastLower) : "-"}</p>
                  </div>
                  <div className={`rounded-[1rem] border px-3 py-2 ${tone.surfaceStrong} ${tone.accentBorder}`}>
                    <p className={`text-[0.62rem] uppercase tracking-[0.16em] ${tone.textSoft}`}>Base</p>
                    <p className={`mt-1 text-sm font-semibold ${tone.text}`}>{forecast ? usdFormatter.format(forecast.forecastPortfolioValue) : "-"}</p>
                  </div>
                  <div className={`rounded-[1rem] border px-3 py-2 ${tone.surfaceMuted} ${tone.panelBorder}`}>
                    <p className={`text-[0.62rem] uppercase tracking-[0.16em] ${tone.textSoft}`}>High</p>
                    <p className={`mt-1 text-sm font-semibold ${tone.text}`}>{forecast ? usdFormatter.format(forecast.forecastUpper) : "-"}</p>
                  </div>
                </div>
              </div>

              <div
                ref={chartAreaRef}
                className={`relative h-[18rem] overflow-hidden rounded-[1rem] border p-3 sm:h-[20rem] ${tone.surfaceMuted} ${tone.panelBorder}`}
                onMouseMove={handleChartMouseMove}
                onMouseLeave={handleChartMouseLeave}
              >
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

                  {graph.historyPath ? (
                    <>
                      <path
                        d={`${graph.historyPath} L ${HISTORY_END_X.toFixed(2)} ${GRAPH_BOTTOM} L 0 ${GRAPH_BOTTOM} Z`}
                        fill="url(#forecast-history-fill)"
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
                        stroke="rgba(240,185,11,0.34)"
                        strokeWidth="0.55"
                        strokeDasharray="1.5 1.8"
                        vectorEffect="non-scaling-stroke"
                      />
                      <line
                        x1={HISTORY_END_X}
                        y1={graph.lastY}
                        x2={FORECAST_END_X}
                        y2={graph.lowerY}
                        stroke="rgba(240,185,11,0.34)"
                        strokeWidth="0.55"
                        strokeDasharray="1.5 1.8"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d={graph.forecastPath}
                        fill="none"
                        stroke="rgba(240,185,11,0.95)"
                        strokeWidth="1"
                        strokeDasharray="2.4 2.2"
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

                {hoverState ? (
                  <div
                    className="pointer-events-none absolute top-3 z-10 -translate-x-1/2 rounded-xl border border-[#3A3F47] bg-[#111418]/95 px-3 py-2 text-[11px] shadow-xl"
                    style={{ left: hoverState.tooltipLeftPx }}
                  >
                    <p className="font-semibold text-white">{hoverState.label}</p>
                    <p className="mt-1 text-[#F0B90B]">{hoverState.value}</p>
                    {hoverState.band ? <p className="mt-1 text-[#9CA3AF]">Band {hoverState.band}</p> : null}
                  </div>
                ) : null}

                <div className={`pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between text-[0.64rem] font-medium uppercase tracking-[0.16em] ${tone.textSoft}`}>
                  <span>5D history</span>
                  <span>Now</span>
                  <span>+48h</span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="space-y-5">
              <section className="space-y-3">
                <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${tone.textSoft}`}>Forecast metrics</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                  <div className="flex items-center justify-between gap-3 border-b border-white/6 pb-2 sm:block sm:border-b-0 sm:pb-0">
                    <span className={tone.textMuted}>Horizon</span>
                    <span className={`font-semibold ${tone.text}`}>{forecast ? `${forecast.horizonHours} hours` : "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-white/6 pb-2 sm:block sm:border-b-0 sm:pb-0">
                    <span className={tone.textMuted}>Confidence</span>
                    <span className={`font-semibold ${tone.text}`}>{forecast ? `${forecast.confidenceScore}/10` : "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-white/6 pb-2 sm:block sm:border-b-0 sm:pb-0">
                    <span className={tone.textMuted}>Projected move</span>
                    <span className={`font-semibold ${forecast && forecast.forecastChangeAbs >= 0 ? tone.accentStrong : tone.dangerText}`}>
                      {forecast ? formatSignedPercent(forecast.forecastChangePct) : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-white/6 pb-2 sm:block sm:border-b-0 sm:pb-0">
                    <span className={tone.textMuted}>Band width</span>
                    <span className={`font-semibold ${tone.text}`}>
                      {forecast ? usdFormatter.format(forecast.forecastUpper - forecast.forecastLower) : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-white/6 pb-2 sm:block sm:border-b-0 sm:pb-0 sm:col-span-2">
                    <span className={tone.textMuted}>Artifact timestamp</span>
                    <span className={`text-right font-semibold ${tone.text}`}>{forecast?.artifactTimestamp ?? "-"}</span>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${tone.textSoft}`}>Asset contribution</p>
                <div className="divide-y divide-white/6 border-y border-white/6">
                  {topBreakdown.length > 0 ? (
                    topBreakdown.map((item) => (
                      <div key={item.symbol} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3 text-sm">
                        <div className="min-w-0">
                          <p className={`font-semibold ${tone.text}`}>{item.symbol}</p>
                          <p className={`mt-1 text-xs ${tone.textSoft}`}>Projected return {item.predictedReturnPct.toFixed(2)}%</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs ${tone.textSoft}`}>Contribution</p>
                          <p className={`font-semibold ${tone.text}`}>{item.contributionPct.toFixed(2)}%</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs ${tone.textSoft}`}>Delta</p>
                          <p className={`font-semibold ${item.changeAbsUsd >= 0 ? tone.accentStrong : tone.dangerText}`}>
                            {formatSignedCurrency(item.changeAbsUsd)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={`py-4 text-sm ${tone.textMuted}`}>
                      {isForecastLoading ? "Loading forecast details..." : forecastError || "No asset contribution data available."}
                    </div>
                  )}
                </div>
              </section>

              {forecastError ? (
                <div className={`rounded-[1rem] border px-4 py-3 text-sm ${tone.dangerBg} ${tone.dangerBorder} ${tone.dangerText}`}>
                  <div className="flex items-center gap-2 font-semibold">
                    <MaterialIcon name="warning" outlined={false} className="text-sm" />
                    Forecast unavailable
                  </div>
                  <p className="mt-1">{forecastError}</p>
                </div>
              ) : null}

              {isForecastLoading ? (
                <div className={`rounded-[1rem] border px-4 py-3 text-sm ${tone.accentBg} ${tone.accentBorder} ${tone.textMuted}`}>
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
