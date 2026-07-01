import { NextResponse } from "next/server";

import { backendBaseUrl } from "@/app/lib/backend-base-url";
import type {
  PortfolioForecast,
  PortfolioForecastResponse,
} from "@/app/lib/portfolio-types";

export const dynamic = "force-dynamic";

type ForecastRequestBody = {
  portfolio?: Array<{
    asset: string;
    amount: number;
    current_price: number;
  }>;
  stablecoin_reserve?: number;
  user_id?: string;
};

type BackendPortfolioForecastAssetProjection = {
  symbol: string;
  current_value_usd: number;
  predicted_return_pct: number;
  forecast_value_usd: number;
  change_abs_usd: number;
  contribution_pct: number;
};

type BackendPortfolioForecastPoint = {
  hour_offset: number;
  value_usd: number;
};

type BackendPortfolioForecastPath = {
  label: string;
  terminal_value_usd: number;
  points: BackendPortfolioForecastPoint[];
};

type BackendPortfolioForecastStepDistribution = {
  hour_offset: number;
  sorted_value_usd: number[];
};

type BackendPortfolioForecastCoverageSummary = {
  covered_symbols: string[];
  uncovered_symbols: string[];
  covered_value_ratio: number;
  sampled_row_count: number;
  lookback_hours: number;
};

type BackendPortfolioForecastData = {
  status: "ready";
  horizon_hours: number;
  forecast_portfolio_value: number;
  forecast_lower: number;
  forecast_upper: number;
  forecast_change_abs: number;
  forecast_change_pct: number;
  confidence_score: number;
  generated_at: string;
  simulation_count: number;
  step_hours: number;
  sample_paths: BackendPortfolioForecastPath[];
  step_distributions: BackendPortfolioForecastStepDistribution[];
  percentile_path_p10: BackendPortfolioForecastPoint[];
  percentile_path_p50: BackendPortfolioForecastPoint[];
  percentile_path_p90: BackendPortfolioForecastPoint[];
  coverage_summary: BackendPortfolioForecastCoverageSummary;
  asset_breakdown: BackendPortfolioForecastAssetProjection[];
};

type BackendPortfolioForecastResponse = {
  status: "success" | "error";
  data?: BackendPortfolioForecastData | null;
  message?: string | null;
  detail?: string | null;
};

function toClientData(data: BackendPortfolioForecastData): PortfolioForecast {
  return {
    status: data.status,
    horizonHours: data.horizon_hours,
    forecastPortfolioValue: data.forecast_portfolio_value,
    forecastLower: data.forecast_lower,
    forecastUpper: data.forecast_upper,
    forecastChangeAbs: data.forecast_change_abs,
    forecastChangePct: data.forecast_change_pct,
    confidenceScore: data.confidence_score,
    generatedAt: data.generated_at,
    simulationCount: data.simulation_count,
    stepHours: data.step_hours,
    samplePaths: data.sample_paths.map((path) => ({
      label: path.label,
      terminalValueUsd: path.terminal_value_usd,
      points: path.points.map((point) => ({
        hourOffset: point.hour_offset,
        valueUsd: point.value_usd,
      })),
    })),
    stepDistributions: data.step_distributions.map((distribution) => ({
      hourOffset: distribution.hour_offset,
      sortedValueUsd: distribution.sorted_value_usd,
    })),
    percentilePathP10: data.percentile_path_p10.map((point) => ({
      hourOffset: point.hour_offset,
      valueUsd: point.value_usd,
    })),
    percentilePathP50: data.percentile_path_p50.map((point) => ({
      hourOffset: point.hour_offset,
      valueUsd: point.value_usd,
    })),
    percentilePathP90: data.percentile_path_p90.map((point) => ({
      hourOffset: point.hour_offset,
      valueUsd: point.value_usd,
    })),
    coverageSummary: {
      coveredSymbols: data.coverage_summary.covered_symbols,
      uncoveredSymbols: data.coverage_summary.uncovered_symbols,
      coveredValueRatio: data.coverage_summary.covered_value_ratio,
      sampledRowCount: data.coverage_summary.sampled_row_count,
      lookbackHours: data.coverage_summary.lookback_hours,
    },
    assetBreakdown: data.asset_breakdown.map((item) => ({
      symbol: item.symbol,
      currentValueUsd: item.current_value_usd,
      predictedReturnPct: item.predicted_return_pct,
      forecastValueUsd: item.forecast_value_usd,
      changeAbsUsd: item.change_abs_usd,
      contributionPct: item.contribution_pct,
    })),
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ForecastRequestBody;

  if (!body.portfolio || body.portfolio.length === 0) {
    return NextResponse.json<PortfolioForecastResponse>(
      { status: "error", message: "Portfolio must contain at least one asset." },
      { status: 422 }
    );
  }

  const response = await fetch(`${backendBaseUrl()}/api/predict/portfolio`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as BackendPortfolioForecastResponse | null;

  if (!response.ok || payload?.status !== "success" || !payload.data) {
    const message =
      payload?.message ||
      payload?.detail ||
      "Portfolio forecast unavailable.";
    return NextResponse.json<PortfolioForecastResponse>(
      { status: "error", message },
      { status: response.status }
    );
  }

  return NextResponse.json<PortfolioForecastResponse>({
    status: "success",
    data: toClientData(payload.data),
  });
}
