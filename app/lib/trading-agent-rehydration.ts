import type { PortfolioAIRecommendation } from "./portfolio-types";
import type { TradingAgentResult } from "./trading-agent-types";

function toneToTrend(
  tone: PortfolioAIRecommendation["signals"][number]["tone"]
): "Bullish" | "Bearish" | "Neutral" {
  if (tone === "Bullish") {
    return "Bullish";
  }

  if (tone === "Bearish") {
    return "Bearish";
  }

  return "Neutral";
}

export function buildTradingAgentResultFromRecommendation(
  recommendation: PortfolioAIRecommendation
): TradingAgentResult {
  const [technicalSignal, marketSignal] = recommendation.signals;
  const concentrationView =
    recommendation.action === "Stop Loss"
      ? "Fragile"
      : recommendation.action === "Reduce Risk" || recommendation.action === "Rebalance"
        ? "Concentrated"
        : "Healthy";
  const cashPosture =
    recommendation.action === "Stop Loss" || recommendation.action === "Reduce Risk"
      ? "Defensive"
      : "Balanced";
  const concentrationRisk =
    recommendation.action === "Stop Loss"
      ? "High"
      : recommendation.action === "Reduce Risk" || recommendation.action === "Rebalance"
        ? "Moderate"
        : "Low";
  const proposalAction = recommendation.action === "Stop Loss" ? "Reduce Risk" : recommendation.action;

  return {
    status: "success",
    workflow_version: recommendation.workflowVersion ?? "trading_agent_v1",
    meta: {
      as_of: recommendation.analyzedAt,
      workflow_version: recommendation.workflowVersion,
      symbols: recommendation.metadata?.primarySymbol ? [recommendation.metadata.primarySymbol] : undefined,
    },
    final_decision: {
      action: recommendation.action,
      confidence: recommendation.confidence,
      summary: recommendation.summary,
      reasoning: recommendation.reasoning,
      portfolio_actions: recommendation.portfolioActions,
      decision_source: "manager_consensus",
      overridden_by_guardrail: recommendation.action === "Stop Loss",
    },
    analyst_reports: {
      technical: technicalSignal
        ? {
            portfolio_trend: toneToTrend(technicalSignal.tone),
            signal_strength: recommendation.confidence,
            strongest_positions: [],
            weakest_positions: [],
            summary: technicalSignal.summary,
            evidence: recommendation.reasoning,
          }
        : null,
      news: marketSignal
        ? {
            market_bias: toneToTrend(marketSignal.tone),
            confidence: recommendation.confidence,
            catalysts: [],
            headwinds: [],
            summary: marketSignal.summary,
          }
        : null,
      sentiment: null,
      portfolio_structure: {
        diversification_view: concentrationView,
        cash_posture: cashPosture,
        concentration_risk: concentrationRisk,
        summary: recommendation.summary,
        actions: recommendation.portfolioActions,
      },
    },
    investment_debate: null,
    portfolio_manager_decision: null,
    trader_proposal: {
      action: proposalAction,
      confidence: recommendation.confidence,
      thesis: recommendation.summary,
      implementation_steps: recommendation.portfolioActions,
    },
    risk_debate: null,
    trace: recommendation.analysisResult?.trace ?? [],
    warnings: recommendation.analysisResult?.warnings ?? [],
    error: recommendation.analysisResult?.error ?? null,
  };
}
