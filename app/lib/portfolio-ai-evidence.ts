import type { PortfolioAIAnalysisEvidence, PortfolioSnapshot } from "./portfolio-types";

const STABLECOINS = new Set(["USDT", "USDC", "BUSD", "FDUSD", "TUSD", "DAI", "USDP", "PYUSD"]);

function cleanSymbol(symbol: string): string {
  return symbol.replace("USDT", "");
}

export function buildPortfolioAIEvidence(snapshot: PortfolioSnapshot): PortfolioAIAnalysisEvidence {
  const sortedAssets = [...snapshot.assets].sort((left, right) => right.allocationPercent - left.allocationPercent);
  const topAsset = sortedAssets[0] ?? null;
  const cashBalanceUsd = snapshot.assets
    .filter((asset) => STABLECOINS.has(cleanSymbol(asset.symbol)))
    .reduce((sum, asset) => sum + asset.valueUsd, 0);
  const cashAllocationPercent =
    snapshot.summary.totalValueUsd > 0 ? (cashBalanceUsd / snapshot.summary.totalValueUsd) * 100 : 0;

  return {
    capturedAt: snapshot.summary.timestamp,
    portfolioValueUsd: snapshot.summary.totalValueUsd,
    topAllocationSymbol: topAsset ? cleanSymbol(topAsset.symbol) : null,
    topAllocationPercent: topAsset?.allocationPercent ?? null,
    cashBalanceUsd,
    cashAllocationPercent,
    volume24hUsd: snapshot.metrics.totalVolume24hUsd,
    riskScore: snapshot.metrics.riskScore ?? null,
    volatilityPercent: snapshot.metrics.volatilityPercent ?? null,
    maxDrawdownPercent: snapshot.metrics.maxDrawdownPercent ?? null,
  };
}
