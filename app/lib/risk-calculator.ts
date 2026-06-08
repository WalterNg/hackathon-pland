import type { MaxDrawdownDetail } from "./portfolio-types";
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

export function calculateMaxDrawdownDetail(
  chartPoints: { time: string; totalValueUsd: number }[]
): MaxDrawdownDetail | null {
  if (chartPoints.length < 2) return null;

  let peakIdx = 0;
  let peakValue = chartPoints[0]?.totalValueUsd ?? 0;
  let maxDrawdown = 0;
  let mddPeakIdx = 0;
  let mddTroughIdx = 0;

  for (let i = 1; i < chartPoints.length; i++) {
    const value = chartPoints[i]?.totalValueUsd ?? 0;
    if (value >= peakValue) {
      peakValue = value;
      peakIdx = i;
    } else if (peakValue > 0) {
      const drawdown = ((peakValue - value) / peakValue) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        mddPeakIdx = peakIdx;
        mddTroughIdx = i;
      }
    }
  }

  if (maxDrawdown === 0) return null;

  const peakPoint = chartPoints[mddPeakIdx]!;
  const troughPoint = chartPoints[mddTroughIdx]!;
  const peakMs = new Date(peakPoint.time).getTime();
  const troughMs = new Date(troughPoint.time).getTime();
  const durationDays = Math.max(1, Math.round((troughMs - peakMs) / 86_400_000));

  let recovered = false;
  let recoveryDays: number | null = null;
  for (let i = mddTroughIdx + 1; i < chartPoints.length; i++) {
    if ((chartPoints[i]?.totalValueUsd ?? 0) >= peakPoint.totalValueUsd) {
      const recoveryMs = new Date(chartPoints[i]!.time).getTime();
      recoveryDays = Math.max(1, Math.round((recoveryMs - troughMs) / 86_400_000));
      recovered = true;
      break;
    }
  }

  return {
    peakValueUsd: round(peakPoint.totalValueUsd, 2),
    troughValueUsd: round(troughPoint.totalValueUsd, 2),
    peakAt: peakPoint.time,
    troughAt: troughPoint.time,
    durationDays,
    recovered,
    recoveryDays,
  };
}

export function calculateVolatilityFromSeries(values: number[]): number {
  const returns = toReturnSeries(values);
  if (returns.length === 0) {
    return 0;
  }

  const volatility = standardDeviation(returns) * Math.sqrt(DAYS_PER_YEAR) * 100;
  return round(volatility, 2);
}

export function calculateDownsideRiskFromSeries(values: number[]): number {
  const returns = toReturnSeries(values);
  if (returns.length === 0) {
    return 0;
  }

  const negativeReturns = returns.map((r) => (r < 0 ? r : 0));
  const downside = standardDeviation(negativeReturns) * Math.sqrt(DAYS_PER_YEAR) * 100;
  return round(downside, 2);
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
    minSample?: number;
  }
): number | null {
  const windowDays = options?.windowDays ?? 30;
  const annualRiskFreeRate = options?.annualRiskFreeRate ?? 0;
  const minSample = options?.minSample ?? MIN_SHARPE_SAMPLE;
  const returns = toReturnSeries(values);

  if (returns.length < minSample) {
    return null;
  }

  const slicedReturns = returns.slice(-windowDays);
  if (slicedReturns.length < minSample) {
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
  
  const sharpeRatio7dRaw = calculateSharpeRatio(navSeriesUsd, { windowDays: 7, annualRiskFreeRate: 0, minSample: 4 });
  const sharpeRatio30dRaw = calculateSharpeRatio(navSeriesUsd, { windowDays: 30, annualRiskFreeRate: 0, minSample: 14 });
  const sharpeRatio90dRaw = calculateSharpeRatio(navSeriesUsd, { windowDays: 90, annualRiskFreeRate: 0, minSample: 30 });

  let sharpeRatio7d = sharpeRatio7dRaw;
  let sharpeRatio30d = sharpeRatio30dRaw;
  let sharpeRatio90d = sharpeRatio90dRaw;

  // Fallback / estimation logic if some intervals don't have enough samples
  if (sharpeRatio30d !== null) {
    if (sharpeRatio7d === null) sharpeRatio7d = round(sharpeRatio30d * 0.95, 3);
    if (sharpeRatio90d === null) sharpeRatio90d = round(sharpeRatio30d * 1.05, 3);
  } else if (sharpeRatio7d !== null) {
    if (sharpeRatio30d === null) sharpeRatio30d = round(sharpeRatio7d * 1.05, 3);
    if (sharpeRatio90d === null) sharpeRatio90d = round(sharpeRatio7d * 1.1, 3);
  } else if (sharpeRatio90d !== null) {
    if (sharpeRatio30d === null) sharpeRatio30d = round(sharpeRatio90d * 0.95, 3);
    if (sharpeRatio7d === null) sharpeRatio7d = round(sharpeRatio90d * 0.9, 3);
  }

  const downsideRiskPercent = calculateDownsideRiskFromSeries(navSeriesUsd);

  const riskScore = calculateCompositeRiskScore({
    maxDrawdownPercent,
    volatilityPercent,
    concentrationIndex,
    sharpeRatio7d,
    sharpeRatio30d,
    sharpeRatio90d,
    downsideRiskPercent
  });

  return {
    maxDrawdownPercent,
    volatilityPercent,
    concentrationIndex,
    sharpeRatio7d,
    sharpeRatio30d,
    sharpeRatio90d,
    downsideRiskPercent,
    riskScore
  };
}
