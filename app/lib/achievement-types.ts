export type AchievementOperator = "gte" | "lte";

export type AchievementDefinition = {
  key: string;
  title: string;
  nickname: string;
  description: string;
  category: "portfolio_level";
  metric: "distinct_assets" | "total_value_usd" | "max_drawdown_percent" | "sharpe_ratio_30d";
  operator: AchievementOperator;
  threshold: number;
  tier: number;
  isActive: boolean;
};

export type PortfolioAchievementUnlock = {
  id: string;
  userId: string;
  portfolioId: string;
  achievementKey: string;
  certificateId: string | null;
  unlockedAt: string;
  snapshotAt: string;
  snapshotHash: string;
  metadata: Record<string, unknown>;
  achievement: AchievementDefinition;
};

export type PortfolioAchievementsResponse = {
  portfolioId: string;
  unlocks: PortfolioAchievementUnlock[];
};
