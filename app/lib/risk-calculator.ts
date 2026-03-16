import type { RiskMetricsSnapshot } from "./risk-types";

const DAYS_PER_YEAR = 365;
const MIN_SHARPE_SAMPLE = 14;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function toReturnSeries(values: number[]): number[] {
  if (values.length < 2) {
    return [];
  }

  const out: number[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1] ?? 0;
    const current = values[index] ?? 0;
    if (previous <= 0 || current <= 0) {
      continue;
    }

    out.push((current - previous) / previous);
  }

  return out;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function calculateMaxDrawdownFromSeries(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  let peak = values[0] ?? 0;
  let maxDrawdown = 0;

  for (const value of values) {
    if (value > peak) {
      peak = value;
      continue;
    }

    if (peak <= 0) {
      continue;
    }

    const drawdown = ((peak - value) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return round(maxDrawdown, 2);
}

export function calculateVolatilityFromSeries(values: number[]): number {
  const returns = toReturnSeries(values);
  if (returns.length === 0) {
    return 0;
  }

  const volatility = standardDeviation(returns) * Math.sqrt(DAYS_PER_YEAR) * 100;
  return round(volatility, 2);
}

export function calculateConcentrationHerfindahl(allocationsPercent: number[]): number {
  if (allocationsPercent.length === 0) {
    return 0;
  }

  const normalized = allocationsPercent
    .map((allocation) => (Number.isFinite(allocation) ? Math.max(0, allocation) : 0))
    .filter((allocation) => allocation > 0);

  if (normalized.length === 0) {
    return 0;
  }

  const total = normalized.reduce((sum, allocation) => sum + allocation, 0);
  if (total <= 0) {
    return 0;
  }

  const herfindahl = normalized.reduce((sum, allocation) => {
    const pct = (allocation / total) * 100;
    return sum + pct ** 2;
  }, 0);

  return round(herfindahl, 2);
}

export function calculateSharpeRatio(
  values: number[],
  options?: {
    windowDays?: number;
    annualRiskFreeRate?: number;
  }
): number | null {
  const windowDays = options?.windowDays ?? 30;
  const annualRiskFreeRate = options?.annualRiskFreeRate ?? 0;
  const returns = toReturnSeries(values);

  if (returns.length < MIN_SHARPE_SAMPLE) {
    return null;
  }

  const slicedReturns = returns.slice(-windowDays);
  if (slicedReturns.length < MIN_SHARPE_SAMPLE) {
    return null;
  }

  const dailyRiskFreeRate = annualRiskFreeRate / DAYS_PER_YEAR;
  const excessReturns = slicedReturns.map((dailyReturn) => dailyReturn - dailyRiskFreeRate);
  const meanExcessReturn = excessReturns.reduce((sum, value) => sum + value, 0) / excessReturns.length;
  const dailyVolatility = standardDeviation(slicedReturns);

  if (!Number.isFinite(dailyVolatility) || dailyVolatility <= 0) {
    return null;
  }

  const sharpe = (meanExcessReturn / dailyVolatility) * Math.sqrt(DAYS_PER_YEAR);
  if (!Number.isFinite(sharpe)) {
    return null;
  }

  return round(sharpe, 3);
}

export function calculateCompositeRiskScore(metrics: Omit<RiskMetricsSnapshot, "riskScore">): number {
  const drawdownRisk = clamp(metrics.maxDrawdownPercent / 25, 0, 1);
  const volatilityRisk = clamp(metrics.volatilityPercent / 80, 0, 1);
  const concentrationRisk = clamp(metrics.concentrationIndex / 10_000, 0, 1);
  const sharpePenalty =
    metrics.sharpeRatio30d === null
      ? 0.5
      : clamp((1.2 - metrics.sharpeRatio30d) / 2.4, 0, 1);

  const score =
    (drawdownRisk * 0.35 +
      volatilityRisk * 0.25 +
      concentrationRisk * 0.25 +
      sharpePenalty * 0.15) *
    100;

  return round(score, 2);
}

export function calculateRiskMetricsFromPortfolio(
  navSeriesUsd: number[],
  allocationsPercent: number[]
): RiskMetricsSnapshot {
  const maxDrawdownPercent = calculateMaxDrawdownFromSeries(navSeriesUsd);
  const volatilityPercent = calculateVolatilityFromSeries(navSeriesUsd);
  const concentrationIndex = calculateConcentrationHerfindahl(allocationsPercent);
  const sharpeRatio30d = calculateSharpeRatio(navSeriesUsd, { windowDays: 30, annualRiskFreeRate: 0 });

  const riskScore = calculateCompositeRiskScore({
    maxDrawdownPercent,
    volatilityPercent,
    concentrationIndex,
    sharpeRatio30d
  });

  return {
    maxDrawdownPercent,
    volatilityPercent,
    concentrationIndex,
    sharpeRatio30d,
    riskScore
  };
}
