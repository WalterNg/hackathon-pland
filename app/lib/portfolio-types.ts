export const PORTFOLIO_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "DOGEUSDT",
] as const;

export type PortfolioSymbol = string;
export type PortfolioMode = "manual" | "binance_connected";

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
  pnlUsd: number;
  pnlPercent: number;
};

export type PortfolioSummary = {
  name: string;
  baseCurrency: "USD";
  timestamp: string;
  totalValueUsd: number;
  totalValueBtc: number | null;
  btcPriceUsd: number | null;
};

export type MaxDrawdownDetail = {
  peakValueUsd: number;
  troughValueUsd: number;
  peakAt: string;       // ISO 8601
  troughAt: string;     // ISO 8601
  durationDays: number; // peak → trough
  recovered: boolean;
  recoveryDays: number | null; // trough → recovery, null if not yet recovered
};

export type PortfolioMetrics = {
  totalVolume24hUsd: number;
  activeAssets: number;
  totalCostBasisUsd: number;
  allTimeProfitUsd: number;
  allTimeProfitPercent: number;
  bestPerformerAllTime: PortfolioPerformer | null;
  worstPerformerAllTime: PortfolioPerformer | null;
  maxDrawdownPercent?: number;
  maxDrawdownDetail?: MaxDrawdownDetail;
  volatilityPercent?: number;
  concentrationIndex?: number;
  sharpeRatio7d?: number | null;
  sharpeRatio30d?: number | null;
  sharpeRatio90d?: number | null;
  downsideRiskPercent?: number;
  riskScore?: number;
  volatilityPercentile?: number;
  expectedShortfallPercent?: number;
  beta?: number;
  breachPenaltyScore?: number;
  violatedRulesCount?: number;
  lastRiskUpdatedAt?: string;
  sortinoRatio30d?: number | null;
  calmarRatio30d?: number | null;
  var95Percent?: number | null;
  topRiskContributorSymbol?: string | null;
  topRiskContributorPercent?: number | null;
};

export type PortfolioRiskViolation = {
  eventType: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  observedValue: number;
  thresholdValue: number | null;
  symbol?: string;
  occurredAt: string;
};

export type PortfolioChartPoint = {
  time: string;
  totalValueUsd: number;
  btcPriceUsd: number | null;
  costBasisUsd: number | null; // running invested capital at this point in time
  dailyReturn?: number | null;
};

export type PortfolioTransaction = {
  symbol: string;
  side: "buy" | "sell" | "deposit" | "withdrawal" | "airdrop" | "fee";
  quantity: number;
  priceUsd: number;
  executedAt: string; // ISO 8601
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
  riskViolations?: PortfolioRiskViolation[];
};

export type AIAnalysisAction =
  | "Accumulate"
  | "Hold"
  | "Reduce Risk"
  | "Rebalance"
  | "Stop Loss";

export type AIAnalysisSignalTone = "Bullish" | "Neutral" | "Bearish" | "Cautious" | "Defensive";

export type AIAnalysisSentimentText = {
  text: string;
  sentiment: "Bullish" | "Bearish" | "Neutral";
};

export type AIRecommendationActionKind =
  | "sell-intent"
  | "apply-protective-rules"
  | "open-alert-center";

export type AIAnalysisComponentSignal = {
  label: string;
  tone: AIAnalysisSignalTone;
  summary: string;
};

export type PortfolioAIAnalysisEvidence = {
  capturedAt: string;
  portfolioValueUsd: number;
  topAllocationSymbol: string | null;
  topAllocationPercent: number | null;
  cashBalanceUsd: number;
  cashAllocationPercent: number;
  volume24hUsd: number;
  riskScore: number | null;
  volatilityPercent: number | null;
  maxDrawdownPercent: number | null;
};

export type PortfolioAIRecommendationLinkedAlert = {
  id: string;
  eventType: string;
  severity: import("@/app/lib/risk-types").RiskSeverity;
  status: import("@/app/lib/risk-types").RiskAlertStatus;
  title: string;
  message: string;
  symbol?: string;
  triggerCount: number;
};

export type PortfolioAIRecommendedAction = {
  type: AIRecommendationActionKind;
  title: string;
  note: string;
  severity: import("@/app/lib/risk-types").RiskSeverity;
  symbol?: string;
  trimPercent?: number;
  values?: import("@/app/lib/risk-types").RiskRulesFormValues;
};

export type PortfolioAIRecommendationMetadata = {
  urgency: import("@/app/lib/risk-types").RiskSeverity;
  primarySymbol: string | null;
  linkedAlerts: PortfolioAIRecommendationLinkedAlert[];
  recommendedActions: PortfolioAIRecommendedAction[];
  suggestedRulePatch: import("@/app/lib/risk-types").RiskRulesFormValues | null;
  suggestedTransactionIntent:
    | {
        action: "sell";
        symbol: string;
        trimPercent: number;
        note: string;
      }
    | null;
};

export type PortfolioAIRecommendation = {
  portfolioUiSessionId?: string | null;
  preparedContext?: import("@/app/lib/trading-agent-types").TradingAgentPreparedContext | null;
  action: AIAnalysisAction;
  confidence: number;
  summary: string;
  reasoning: (string | AIAnalysisSentimentText)[];
  portfolioActions: string[];
  signals: AIAnalysisComponentSignal[];
  analyzedAt: string;
  snapshotTimestamp: string;
  evidence: PortfolioAIAnalysisEvidence;
  workflowVersion?: string;
  metadata?: PortfolioAIRecommendationMetadata;
  analysisResult?: import("@/app/lib/trading-agent-types").TradingAgentResult | null;
};

export type PortfolioAIRecommendationHistoryItem = {
  id: string;
  analyzedAt: string;
  createdAt: string;
  action: AIAnalysisAction;
  confidence: number;
  portfolioUiSessionId: string | null;
  recommendation: PortfolioAIRecommendation;
};

export type PortfolioAIRecommendationHistoryPage = {
  items: PortfolioAIRecommendationHistoryItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
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
