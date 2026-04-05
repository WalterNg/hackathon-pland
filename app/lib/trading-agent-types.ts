import type { PortfolioAIRecommendation } from "@/app/lib/portfolio-types";

export type TradingAgentTraceStatus = "started" | "completed" | "skipped" | "error";

export type TradingAgentTraceEvent = {
  step: string;
  status: TradingAgentTraceStatus;
  detail: string;
};

export type TradingAgentTechnicalReport = {
  portfolio_trend: "Bullish" | "Bearish" | "Neutral";
  signal_strength: number;
  strongest_positions: string[];
  weakest_positions: string[];
  summary: string;
  evidence: string[];
};

export type TradingAgentNewsReport = {
  market_bias: "Bullish" | "Bearish" | "Neutral";
  confidence: number;
  catalysts: string[];
  headwinds: string[];
  summary: string;
};

export type TradingAgentSentimentReport = {
  sentiment_bias: "Bullish" | "Bearish" | "Neutral";
  confidence: number;
  drivers: string[];
  summary: string;
};

export type TradingAgentPortfolioStructureReport = {
  diversification_view: "Healthy" | "Concentrated" | "Fragile";
  cash_posture: "Deployable" | "Balanced" | "Defensive";
  concentration_risk: "Low" | "Moderate" | "High";
  summary: string;
  actions: string[];
};

export type TradingAgentAnalystReports = {
  technical?: TradingAgentTechnicalReport | null;
  news?: TradingAgentNewsReport | null;
  sentiment?: TradingAgentSentimentReport | null;
  portfolio_structure?: TradingAgentPortfolioStructureReport | null;
} | null;

export type TradingAgentDebateTurn = {
  speaker: string;
  stance: string;
  message: string;
};

export type TradingAgentInvestmentDebate = {
  history: TradingAgentDebateTurn[];
  bull_case: string;
  bear_case: string;
  latest_message: string;
  latest_speaker: string;
  round_count: number;
  manager_summary: string;
} | null;

export type TradingAgentPortfolioManagerDecision = {
  stance: "Accumulate" | "Hold" | "Reduce Risk" | "Rebalance";
  confidence: number;
  summary: string;
  reasoning: string[];
} | null;

export type TradingAgentTraderProposal = {
  action: "Accumulate" | "Hold" | "Reduce Risk" | "Rebalance";
  confidence: number;
  thesis: string;
  implementation_steps: string[];
} | null;

export type TradingAgentRiskDebate = {
  history: TradingAgentDebateTurn[];
  aggressive_view: string;
  neutral_view: string;
  conservative_view: string;
  latest_message: string;
  latest_speaker: string;
  round_count: number;
  judge_summary: string;
  final_risk_level: "Low" | "Moderate" | "High" | "Critical";
  capital_preservation_bias: "Bullish" | "Neutral" | "Defensive";
  constraints: string[];
} | null;

export type TradingAgentFinalDecision = {
  action: PortfolioAIRecommendation["action"];
  confidence: number;
  summary: string;
  reasoning: string[];
  portfolio_actions: string[];
  decision_source: "manager_consensus" | "trader_proposal" | "risk_judge" | "guardrail_override";
  overridden_by_guardrail: boolean;
} | null;

export type TradingAgentResult = {
  status: "success" | "error";
  workflow_version: string;
  meta?: {
    user_id?: string;
    portfolio_id?: string;
    as_of?: string;
    symbols?: string[];
    workflow_version?: string;
  } | null;
  final_decision?: TradingAgentFinalDecision;
  analyst_reports?: TradingAgentAnalystReports;
  investment_debate?: TradingAgentInvestmentDebate;
  portfolio_manager_decision?: TradingAgentPortfolioManagerDecision;
  trader_proposal?: TradingAgentTraderProposal;
  risk_debate?: TradingAgentRiskDebate;
  trace: TradingAgentTraceEvent[];
  warnings: string[];
  error?: string | null;
};

export type TradingAgentStepEvent = {
  nodes: string[];
  state: Record<string, unknown>;
  trace: TradingAgentTraceEvent[];
  warnings: string[];
};

export type TradingAgentStreamDoneEvent = {
  recommendation: PortfolioAIRecommendation;
  workflowVersion: string;
  warning: string | null;
  result: TradingAgentResult;
};

export type TradingAgentStreamStartEvent = {
  status: "started";
  workflow_version: string;
};

export type TradingAgentStreamErrorEvent = {
  status: "error";
  message: string;
};
