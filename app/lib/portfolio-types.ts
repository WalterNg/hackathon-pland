export const PORTFOLIO_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "DOGEUSDT",
] as const;

export type PortfolioSymbol = string;

export type PortfolioPosition = {
  symbol: PortfolioSymbol;
  quantity: number;
  avgBuyPriceUsd: number;
};

export type Binance24hrTicker = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
};

export type PortfolioPerformer = {
  symbol: string;
  change24hPercent: number;
};

export type PortfolioSummary = {
  name: string;
  baseCurrency: "USD";
  timestamp: string;
  totalValueUsd: number;
  totalValueBtc: number | null;
  btcPriceUsd: number | null;
};

export type PortfolioMetrics = {
  totalVolume24hUsd: number;
  activeAssets: number;
  totalCostBasisUsd: number;
  allTimeProfitUsd: number;
  allTimeProfitPercent: number;
  bestPerformer24h: PortfolioPerformer | null;
  worstPerformer24h: PortfolioPerformer | null;
};

export type PortfolioChartPoint = {
  time: string;
  totalValueUsd: number;
};

export type PortfolioAssetRow = {
  symbol: string;
  quantity: number;
  avgBuyPriceUsd: number;
  priceUsd: number;
  valueUsd: number;
  allocationPercent: number;
  change24hPercent: number;
  change7dPercent: number;
  pnlUsd: number;
  pnlPercent: number;
  volume24hUsd: number;
};

export type PortfolioSnapshot = {
  summary: PortfolioSummary;
  metrics: PortfolioMetrics;
  chart: PortfolioChartPoint[];
  assets: PortfolioAssetRow[];
};

export type DashboardRecentTransaction = {
  id: string;
  portfolioName: string;
  symbol: string;
  side: "buy" | "sell" | "deposit" | "withdrawal" | "airdrop" | "fee";
  quantity: number;
  priceUsd: number;
  executedAt: string;
};
