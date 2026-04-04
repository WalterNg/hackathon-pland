import { NextResponse } from "next/server";

import { buildBinancePortfolioSnapshot } from "@/app/lib/binance-portfolio";
import { deriveRecommendationMetadata } from "@/app/lib/portfolio-ai-actions";
import { buildPortfolioAIEvidence } from "@/app/lib/portfolio-ai-evidence";
import type { PortfolioAIRecommendation } from "@/app/lib/portfolio-types";
import { getLatestPortfolioAIRecommendation, savePortfolioAIRecommendation } from "@/app/lib/repositories/portfolio-ai-recommendations-repo";
import { getActiveRiskProfileByPortfolio, listRiskAlerts } from "@/app/lib/repositories/risk-repo";
import { getUserPortfolioPositions } from "@/app/lib/repositories/portfolio-repo";
import { resolveUserPortfolioByName } from "@/app/lib/repositories/portfolios-repo";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

type AnalyzeRequestBody = {
  portfolioName?: string;
};

type BackendTradingAgentResponse = {
  status: "success" | "error";
  workflow_version?: string;
  meta?: {
    as_of?: string;
    portfolio_id?: string;
    symbols?: string[];
  } | null;
  final_decision?: {
    action: PortfolioAIRecommendation["action"];
    confidence: number;
    summary: string;
    reasoning: string[];
    portfolio_actions: string[];
    decision_source: string;
    overridden_by_guardrail: boolean;
  } | null;
  analyst_reports?: {
    technical?: {
      portfolio_trend: "Bullish" | "Bearish" | "Neutral";
      signal_strength: number;
      summary: string;
    } | null;
    news?: {
      market_bias: "Bullish" | "Bearish" | "Neutral";
      summary: string;
    } | null;
    sentiment?: {
      sentiment_bias: "Bullish" | "Bearish" | "Neutral";
      summary: string;
    } | null;
    portfolio_structure?: {
      concentration_risk: "Low" | "Moderate" | "High";
      summary: string;
    } | null;
  } | null;
  risk_debate?: {
    final_risk_level: "Low" | "Moderate" | "High" | "Critical";
    capital_preservation_bias: "Bullish" | "Neutral" | "Defensive";
    judge_summary: string;
  } | null;
  warnings?: string[];
  error?: string | null;
};

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";
const WORKFLOW_VERSION = "trading_agent_v1";

function backendBaseUrl(): string {
  return (
    process.env.AI_BACKEND_URL?.trim() ||
    process.env.BACKEND_API_URL?.trim() ||
    DEFAULT_BACKEND_URL
  );
}

async function getAuthContext(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (authorization) {
    return getSupabaseAuthContext(request);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

function normalizeSignalTone(
  label: "TA" | "News / Market" | "Risk",
  value: string | undefined
): PortfolioAIRecommendation["signals"][number]["tone"] {
  if (label === "Risk") {
    if (value === "Critical" || value === "High") {
      return "Defensive";
    }
    if (value === "Moderate") {
      return "Cautious";
    }
    return "Neutral";
  }

  if (value === "Bullish") {
    return "Bullish";
  }
  if (value === "Bearish") {
    return "Bearish";
  }
  return "Neutral";
}

async function getAuthorizedPortfolio(request: Request, portfolioNameInput?: string | null) {
  const { supabase, user } = await getAuthContext(request);
  const portfolioName = portfolioNameInput?.trim() || DEFAULT_PORTFOLIO_NAME;

  if (!user?.id) {
    return { supabase, user, portfolio: null, portfolioName };
  }

  const portfolio = await resolveUserPortfolioByName(supabase, user.id, portfolioName);
  return { supabase, user, portfolio, portfolioName };
}

function recommendationPortfolioId(portfolioId: string): string {
  return `${portfolioId}::${WORKFLOW_VERSION}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const context = await getAuthorizedPortfolio(request, searchParams.get("portfolioName"));

  if (!context.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  const recommendation = await getLatestPortfolioAIRecommendation(
    context.supabase,
    context.user.id,
    recommendationPortfolioId(context.portfolio.id)
  );

  return NextResponse.json({ recommendation });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalyzeRequestBody;
  const context = await getAuthorizedPortfolio(request, body.portfolioName);

  if (!context.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  const { supabase, user, portfolio, portfolioName } = context;
  const positions = await getUserPortfolioPositions(supabase, user.id, portfolioName);

  if (positions === null) {
    return NextResponse.json({ error: "Unable to resolve portfolio positions." }, { status: 500 });
  }

  if (positions.length === 0) {
    return NextResponse.json({ error: "Portfolio must contain at least one asset to analyze." }, { status: 422 });
  }

  const snapshot = await buildBinancePortfolioSnapshot(portfolioName, positions);
  const [activeRiskProfile, activeAlerts] = await Promise.all([
    getActiveRiskProfileByPortfolio(supabase, user.id, portfolio.id),
    listRiskAlerts(supabase, user.id, portfolio.id, "active", 20),
  ]);

  const portfolioItems = positions
    .map((position) => {
      const assetRow = snapshot.assets.find((asset) => asset.symbol === position.symbol);
      if (!assetRow || assetRow.priceUsd <= 0) {
        return null;
      }

      return {
        asset: position.symbol,
        amount: position.quantity,
        current_price: assetRow.priceUsd,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (portfolioItems.length === 0) {
    return NextResponse.json({ error: "Unable to build a live market snapshot for this portfolio." }, { status: 502 });
  }

  const response = await fetch(`${backendBaseUrl()}/api/trading-agent/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      user_id: user.id,
      portfolio: portfolioItems,
      stablecoin_reserve: 0,
      news_headlines: [],
      social_dominance: 0,
    }),
  });

  const payload = (await response.json().catch(() => null)) as BackendTradingAgentResponse | null;

  if (!response.ok || payload?.status !== "success" || !payload.final_decision) {
    const message = payload?.error || "Trading agent backend request failed.";
    return NextResponse.json({ error: message, warning: payload?.warnings?.[0] ?? null }, { status: response.ok ? 502 : response.status });
  }

  const recommendationBase: PortfolioAIRecommendation = {
    action: payload.final_decision.action,
    confidence: payload.final_decision.confidence,
    summary: payload.final_decision.summary,
    reasoning: payload.final_decision.reasoning,
    portfolioActions: payload.final_decision.portfolio_actions,
    analyzedAt: payload.meta?.as_of || new Date().toISOString(),
    snapshotTimestamp: snapshot.summary.timestamp,
    evidence: buildPortfolioAIEvidence(snapshot),
    workflowVersion: payload.workflow_version || WORKFLOW_VERSION,
    signals: [
      {
        label: "TA",
        tone: normalizeSignalTone("TA", payload.analyst_reports?.technical?.portfolio_trend),
        summary:
          payload.analyst_reports?.technical?.summary ||
          "Technical analyst output was not available for this run.",
      },
      {
        label: "News / Market",
        tone: normalizeSignalTone("News / Market", payload.analyst_reports?.news?.market_bias),
        summary:
          payload.analyst_reports?.news?.summary ||
          payload.analyst_reports?.sentiment?.summary ||
          "External market context was limited for this run.",
      },
      {
        label: "Risk",
        tone: normalizeSignalTone("Risk", payload.risk_debate?.final_risk_level),
        summary:
          payload.risk_debate?.judge_summary ||
          "Risk debate summary was not available for this run.",
      },
    ],
  };

  const recommendation: PortfolioAIRecommendation = {
    ...recommendationBase,
    metadata: deriveRecommendationMetadata(recommendationBase, activeAlerts, activeRiskProfile),
  };

  await savePortfolioAIRecommendation(
    supabase,
    user.id,
    recommendationPortfolioId(portfolio.id),
    recommendation
  );

  return NextResponse.json({
    recommendation,
    workflowVersion: recommendation.workflowVersion,
    warning: payload.warnings?.[0] ?? null,
  });
}
