export type JournalTradeItem = {
  id: string;
  executedAt: string;
  portfolioName: string;
  pair: string;
  side: "sell";
  entryPriceUsd: number | null;
  exitPriceUsd: number | null;
  pnlUsd: number | null;
  entryPriceBtc: number | null;
  exitPriceBtc: number | null;
  pnlBtc: number | null;
  notes: string | null;
};

export type JournalDailyPoint = {
  date: string;
  pnlUsd: number;
  pnlBtc: number;
};

export type JournalDistributionItem = {
  label: string;
  percent: number;
  count: number;
};

export type JournalEmotionItem = {
  label: string;
  trades: number;
  winRate: number | null;
};

export type JournalSummaryPayload = {
  kpis: {
    winRate: number | null;
    netPnlUsd: number;
    netPnlBtc: number;
    netPnlChangePercent: number | null;
    averageRiskReward: number | null;
    sharpeRatio30d: number | null;
  };
  dailyPerformance: JournalDailyPoint[];
  trades: JournalTradeItem[];
  distribution: JournalDistributionItem[];
  emotions: JournalEmotionItem[];
  totalTrades: number;
  range: {
    from: string;
    to: string;
    days: number;
  };
};
