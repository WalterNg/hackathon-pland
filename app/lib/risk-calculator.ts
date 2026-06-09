import type { MaxDrawdownDetail, PortfolioChartPoint } from "./portfolio-types";
import type { RiskMetricsSnapshot } from "./risk-types";

const DAYS_PER_YEAR = 365;
const MIN_SHARPE_SAMPLE = 14;
const VOLATILITY_CAP_PERCENT = 150;
const EXPECTED_SHORTFALL_CAP_PERCENT = 10;
const MAX_DRAWDOWN_CAP_PERCENT = 50;
const CONCENTRATION_EFFECTIVE_CAP = 10;
const BETA_CAP = 2;
const DEFAULT_BREACH_PENALTY_PER_VIOLATION = 25;

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

type ChartSeriesPoint = Pick<PortfolioChartPoint, "totalValueUsd" | "btcPriceUsd" | "dailyReturn">;

type RiskScoreInputs = {
  volatilityScore: number;
  expectedShortfallScore: number;
  maxDrawdownScore: number;
  concentrationScore: number;
  betaScore: number;
  stressPenaltyScore: number;
};

type RiskMetricOptions = {
  breachPenaltyScore?: number;
  topRiskContributorSymbol?: string | null;
  topRiskContributorPercent?: number | null;
};

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

export function calculateVolatilityFromReturns(returns: number[]): number {
  if (returns.length === 0) {
    return 0;
  }

  const volatility = standardDeviation(returns) * Math.sqrt(DAYS_PER_YEAR) * 100;
  return round(volatility, 2);
}

export function calculateVolatilityFromSeries(values: number[]): number {
  return calculateVolatilityFromReturns(toReturnSeries(values));
}

export function calculateVolatilityPercentileFromReturns(
  returns: number[],
  currentVolatility: number
): number {
  if (returns.length < 35) {
    return round(estimateVolatilityPercentile(currentVolatility), 1);
  }

  const historicalVols: number[] = [];
  for (let i = 30; i <= returns.length; i++) {
    const slice = returns.slice(i - 30, i);
    const vol = calculateVolatilityFromReturns(slice);
    if (vol > 0) {
      historicalVols.push(vol);
    }
  }

  if (historicalVols.length < 5) {
    return round(estimateVolatilityPercentile(currentVolatility), 1);
  }

  const count = historicalVols.filter((v) => v <= currentVolatility).length;
  const pct = (count / historicalVols.length) * 100;
  return round(pct, 1);
}

export function calculateVolatilityPercentile(
  values: number[],
  currentVolatility: number
): number {
  return calculateVolatilityPercentileFromReturns(toReturnSeries(values), currentVolatility);
}

function estimateVolatilityPercentile(volatility: number): number {
  if (volatility <= 10) return 5;
  if (volatility <= 30) return 5 + ((volatility - 10) / 20) * 25;
  if (volatility <= 60) return 30 + ((volatility - 30) / 30) * 35;
  if (volatility <= 120) return 65 + ((volatility - 60) / 60) * 20;
  if (volatility <= 250) return 85 + ((volatility - 120) / 130) * 12;
  return Math.min(100, 97 + ((volatility - 250) / 250) * 3);
}

export function calculateExpectedShortfallFromReturns(returns: number[]): number {
  if (returns.length === 0) {
    return 0;
  }

  const tailSampleCount = Math.max(1, Math.ceil(returns.length * 0.05));
  const worstReturns = [...returns].sort((left, right) => left - right).slice(0, tailSampleCount);
  const expectedShortfall = worstReturns.reduce((sum, value) => sum + value, 0) / worstReturns.length;
  return round(Math.max(0, -expectedShortfall) * 100, 2);
}

export function calculateExpectedShortfallFromSeries(values: number[]): number {
  return calculateExpectedShortfallFromReturns(toReturnSeries(values));
}

export function calculateDownsideRiskFromReturns(returns: number[]): number {
  if (returns.length === 0) {
    return 0;
  }

  const negativeReturns = returns.map((r) => (r < 0 ? r : 0));
  const downside = standardDeviation(negativeReturns) * Math.sqrt(DAYS_PER_YEAR) * 100;
  return round(downside, 2);
}

export function calculateDownsideRiskFromSeries(values: number[]): number {
  return calculateDownsideRiskFromReturns(toReturnSeries(values));
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

function calculateConcentrationEffectiveNumber(allocationsPercent: number[]): number {
  const herfindahl = calculateConcentrationHerfindahl(allocationsPercent);
  if (herfindahl <= 0) {
    return 0;
  }

  return round(10_000 / herfindahl, 2);
}

function calculateVolatilityScore(volatilityPercent: number): number {
  return round(clamp((volatilityPercent / VOLATILITY_CAP_PERCENT) * 100, 0, 100), 2);
}

function calculateExpectedShortfallScore(expectedShortfallPercent: number): number {
  return round(clamp((expectedShortfallPercent / EXPECTED_SHORTFALL_CAP_PERCENT) * 100, 0, 100), 2);
}

function calculateMaxDrawdownScore(maxDrawdownPercent: number): number {
  return round(clamp((Math.abs(maxDrawdownPercent) / MAX_DRAWDOWN_CAP_PERCENT) * 100, 0, 100), 2);
}

function calculateConcentrationScore(effectiveNumberOfPositions: number): number {
  if (effectiveNumberOfPositions <= 0) {
    return 0;
  }

  const rawScore = ((CONCENTRATION_EFFECTIVE_CAP - effectiveNumberOfPositions) / (CONCENTRATION_EFFECTIVE_CAP - 1)) * 100;
  return round(clamp(rawScore, 0, 100), 2);
}

function calculateBetaFromChart(chartPoints: ChartSeriesPoint[]): number {
  const pairedReturns: Array<{ portfolioReturn: number; benchmarkReturn: number }> = [];

  for (let index = 1; index < chartPoints.length; index += 1) {
    const previous = chartPoints[index - 1];
    const current = chartPoints[index];

    const previousPortfolioValue = previous?.totalValueUsd ?? 0;
    const currentPortfolioValue = current?.totalValueUsd ?? 0;
    const previousBenchmarkValue = previous?.btcPriceUsd ?? 0;
    const currentBenchmarkValue = current?.btcPriceUsd ?? 0;

    if (
      previousPortfolioValue <= 0 ||
      currentPortfolioValue <= 0 ||
      previousBenchmarkValue <= 0 ||
      currentBenchmarkValue <= 0
    ) {
      continue;
    }

    const portfolioReturn =
      current && (current as any).dailyReturn !== undefined && (current as any).dailyReturn !== null
        ? (current as any).dailyReturn
        : (currentPortfolioValue - previousPortfolioValue) / previousPortfolioValue;

    const benchmarkReturn = (currentBenchmarkValue - previousBenchmarkValue) / previousBenchmarkValue;

    if (Number.isFinite(portfolioReturn) && Number.isFinite(benchmarkReturn)) {
      pairedReturns.push({ portfolioReturn, benchmarkReturn });
    }
  }

  if (pairedReturns.length < 2) {
    return 0;
  }

  const benchmarkMean = pairedReturns.reduce((sum, pair) => sum + pair.benchmarkReturn, 0) / pairedReturns.length;
  const portfolioMean = pairedReturns.reduce((sum, pair) => sum + pair.portfolioReturn, 0) / pairedReturns.length;

  let covariance = 0;
  let benchmarkVariance = 0;
  for (const pair of pairedReturns) {
    const benchmarkDelta = pair.benchmarkReturn - benchmarkMean;
    covariance += (pair.portfolioReturn - portfolioMean) * benchmarkDelta;
    benchmarkVariance += benchmarkDelta ** 2;
  }

  if (benchmarkVariance <= 0) {
    return 0;
  }

  return round(covariance / benchmarkVariance, 3);
}

function calculateBetaScore(beta: number): number {
  return round(clamp((Math.abs(beta) / BETA_CAP) * 100, 0, 100), 2);
}

function calculateStressPenaltyScore(totalBreachPenalty: number): number {
  return round(clamp(totalBreachPenalty, 0, 100), 2);
}

export function calculateDefaultBreachPenaltyScore(violationCount: number): number {
  if (violationCount <= 0) {
    return 0;
  }

  return round(clamp(violationCount * DEFAULT_BREACH_PENALTY_PER_VIOLATION, 0, 100), 2);
}

export function getRiskScoreBand(score: number): { label: string; textClass: string; pillClass: string } {
  const clampedScore = clamp(score, 0, 100);
  if (clampedScore <= 20) return { label: "Very Low Risk", textClass: "text-emerald-400", pillClass: "status-pill-positive" };
  if (clampedScore <= 40) return { label: "Low Risk", textClass: "text-emerald-300", pillClass: "status-pill-positive" };
  if (clampedScore <= 60) return { label: "Moderate Risk", textClass: "text-amber-300", pillClass: "bg-amber-500/10 text-amber-300 border border-amber-500/10 px-2.5 py-1" };
  if (clampedScore <= 80) return { label: "High Risk", textClass: "text-orange-300", pillClass: "bg-orange-500/10 text-orange-300 border border-orange-500/10 px-2.5 py-1" };
  return { label: "Extreme Risk", textClass: "text-danger", pillClass: "status-pill-negative" };
}

export function calculateSharpeRatioFromReturns(
  returns: number[],
  options?: {
    windowDays?: number;
    annualRiskFreeRate?: number;
    minSample?: number;
  }
): number | null {
  const windowDays = options?.windowDays ?? 30;
  const annualRiskFreeRate = options?.annualRiskFreeRate ?? 0;
  const minSample = options?.minSample ?? MIN_SHARPE_SAMPLE;

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

export function calculateSharpeRatio(
  values: number[],
  options?: {
    windowDays?: number;
    annualRiskFreeRate?: number;
    minSample?: number;
  }
): number | null {
  return calculateSharpeRatioFromReturns(toReturnSeries(values), options);
}

export function calculateSortinoRatioFromReturns(
  returns: number[],
  options?: {
    windowDays?: number;
    annualRiskFreeRate?: number;
    minSample?: number;
  }
): number | null {
  const windowDays = options?.windowDays ?? 30;
  const annualRiskFreeRate = options?.annualRiskFreeRate ?? 0;
  const minSample = options?.minSample ?? MIN_SHARPE_SAMPLE;

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

  const negativeReturns = slicedReturns.map((r) => (r < 0 ? r : 0));
  const dailyDownsideVolatility = standardDeviation(negativeReturns);

  if (!Number.isFinite(dailyDownsideVolatility) || dailyDownsideVolatility <= 0) {
    return null;
  }

  const sortino = (meanExcessReturn / dailyDownsideVolatility) * Math.sqrt(DAYS_PER_YEAR);
  if (!Number.isFinite(sortino)) {
    return null;
  }

  return round(sortino, 3);
}

export function calculateCalmarRatioFromReturns(
  returns: number[],
  maxDrawdownPercent: number,
  options?: {
    windowDays?: number;
    minSample?: number;
  }
): number | null {
  const windowDays = options?.windowDays ?? 30;
  const minSample = options?.minSample ?? MIN_SHARPE_SAMPLE;

  if (returns.length < minSample) {
    return null;
  }

  const slicedReturns = returns.slice(-windowDays);
  if (slicedReturns.length < minSample) {
    return null;
  }

  if (maxDrawdownPercent <= 0) {
    return null;
  }

  let cumProd = 1;
  for (const r of slicedReturns) {
    cumProd *= (1 + r);
  }
  const cumulativeReturn = cumProd - 1;
  const compoundRatio = Math.max(0.0001, cumProd);
  const annualizedReturn = (compoundRatio) ** (DAYS_PER_YEAR / slicedReturns.length) - 1;
  const annualizedReturnPercent = annualizedReturn * 100;

  const calmar = annualizedReturnPercent / maxDrawdownPercent;
  if (!Number.isFinite(calmar)) {
    return null;
  }

  return round(calmar, 3);
}

export function calculateVaR95FromReturns(
  returns: number[],
  options?: {
    windowDays?: number;
    minSample?: number;
  }
): number | null {
  const windowDays = options?.windowDays ?? 30;
  const minSample = options?.minSample ?? MIN_SHARPE_SAMPLE;

  if (returns.length < minSample) {
    return null;
  }

  const slicedReturns = returns.slice(-windowDays);
  if (slicedReturns.length < minSample) {
    return null;
  }

  const sorted = [...slicedReturns].sort((left, right) => left - right);
  const index = Math.floor(sorted.length * 0.05);
  const varVal = sorted[index] ?? 0;
  
  return round(Math.max(0, -varVal) * 100, 2);
}

export function calculateCompositeRiskScore(inputs: RiskScoreInputs): number {
  const score =
    inputs.volatilityScore * 0.20 +
    inputs.expectedShortfallScore * 0.25 +
    inputs.maxDrawdownScore * 0.20 +
    inputs.concentrationScore * 0.15 +
    inputs.betaScore * 0.10 +
    inputs.stressPenaltyScore * 0.10;

  return round(clamp(score, 0, 100), 2);
}

export function calculateRiskMetricsFromPortfolio(
  chartPoints: ChartSeriesPoint[],
  allocationsPercent: number[],
  options: RiskMetricOptions = {}
): RiskMetricsSnapshot {
  const navSeriesUsd = chartPoints.map((point) => point.totalValueUsd);
  const maxDrawdownPercent = calculateMaxDrawdownFromSeries(navSeriesUsd);

  const hasDailyReturns = chartPoints.some(
    (point) => point.dailyReturn !== undefined && point.dailyReturn !== null
  );

  const returns = hasDailyReturns
    ? chartPoints
        .map((point) => point.dailyReturn)
        .filter((r): r is number => r !== undefined && r !== null)
    : toReturnSeries(navSeriesUsd);

  // Filter extreme outliers (e.g. daily returns > 300% or < -90% are pricing glitches or unadjusted cash flows)
  const filteredReturns = returns.filter((r) => r >= -0.9 && r <= 3.0);

  const volatilityPercent = calculateVolatilityFromReturns(filteredReturns);
  const concentrationIndex = calculateConcentrationHerfindahl(allocationsPercent);
  const expectedShortfallPercent = calculateExpectedShortfallFromReturns(filteredReturns);
  const concentrationEffectiveNumber = calculateConcentrationEffectiveNumber(allocationsPercent);
  const beta = calculateBetaFromChart(chartPoints);
  const breachPenaltyScore = calculateStressPenaltyScore(options.breachPenaltyScore ?? 0);

  const sharpeRatio7dRaw = calculateSharpeRatioFromReturns(filteredReturns, { windowDays: 7, annualRiskFreeRate: 0, minSample: 4 });
  const sharpeRatio30dRaw = calculateSharpeRatioFromReturns(filteredReturns, { windowDays: 30, annualRiskFreeRate: 0, minSample: 14 });
  const sharpeRatio90dRaw = calculateSharpeRatioFromReturns(filteredReturns, { windowDays: 90, annualRiskFreeRate: 0, minSample: 30 });

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

  const downsideRiskPercent = calculateDownsideRiskFromReturns(filteredReturns);
  const volatilityPercentile = calculateVolatilityPercentileFromReturns(filteredReturns, volatilityPercent);

  const riskScore = calculateCompositeRiskScore({
    volatilityScore: calculateVolatilityScore(volatilityPercent),
    expectedShortfallScore: calculateExpectedShortfallFromSeries(navSeriesUsd),
    maxDrawdownScore: calculateMaxDrawdownScore(maxDrawdownPercent),
    concentrationScore: calculateConcentrationScore(concentrationEffectiveNumber),
    betaScore: calculateBetaScore(beta),
    stressPenaltyScore: breachPenaltyScore,
  });

  const sortinoRatio30d = calculateSortinoRatioFromReturns(filteredReturns, { windowDays: 30, annualRiskFreeRate: 0, minSample: 14 });
  const calmarRatio30d = calculateCalmarRatioFromReturns(filteredReturns, maxDrawdownPercent, { windowDays: 30, minSample: 14 });
  const var95Percent = calculateVaR95FromReturns(filteredReturns, { windowDays: 30, minSample: 14 });

  return {
    maxDrawdownPercent,
    volatilityPercent,
    concentrationIndex,
    sharpeRatio7d,
    sharpeRatio30d,
    sharpeRatio90d,
    downsideRiskPercent,
    riskScore,
    volatilityPercentile,
    expectedShortfallPercent,
    beta,
    breachPenaltyScore,
    sortinoRatio30d,
    calmarRatio30d,
    var95Percent,
    topRiskContributorSymbol: options.topRiskContributorSymbol ?? null,
    topRiskContributorPercent: options.topRiskContributorPercent ?? null,
  };
}
