import { NextResponse } from "next/server";

import { buildBinancePortfolioSnapshot } from "@/app/lib/binance-portfolio";
import { buildPortfolioAIEvidence } from "@/app/lib/portfolio-ai-evidence";
import type { PortfolioAIRecommendation } from "@/app/lib/portfolio-types";
import {
  getLatestPortfolioAIRecommendation,
  savePortfolioAIRecommendation,
} from "@/app/lib/repositories/portfolio-ai-recommendations-repo";
import { getUserPortfolioPositions } from "@/app/lib/repositories/portfolio-repo";
import { resolveUserPortfolioByName } from "@/app/lib/repositories/portfolios-repo";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

type AnalyzeRequestBody = {
  portfolioName?: string;
};

type BackendEvaluationResponse = {
  status: "success" | "error";
  data?: {
    meta?: {
      as_of?: string;
      portfolio_id?: string;
      symbols?: string[];
    };
    final_decision?: {
      action: PortfolioAIRecommendation["action"];
      confidence: number;
      summary: string;
      reasoning: string[];
      portfolio_actions: string[];
    };
    components?: {
      ta_result?: {
        portfolio_trend: "Bullish" | "Bearish" | "Neutral";
        signal_strength: number;
        recommended_action: string;
      } | null;
      news_market_result?: {
        market_bias: "Bullish" | "Bearish" | "Neutral";
        confidence: number;
        narrative_summary: string;
      } | null;
      risk_result?: {
        risk_level: "Low" | "Moderate" | "High" | "Critical";
        capital_preservation_bias: "Bullish" | "Neutral" | "Defensive";
        risk_alerts: string[];
      } | null;
    };
    message?: string;
  };
};

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

function backendBaseUrl(): string {
  return (
    process.env.AI_BACKEND_URL?.trim() ||
    process.env.BACKEND_API_URL?.trim() ||
    DEFAULT_BACKEND_URL
  );
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

async function getAuthorizedPortfolio(portfolioNameInput?: string | null) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const portfolioName = portfolioNameInput?.trim() || "Main Portfolio";
  if (!user?.id) {
    return { supabase, user, portfolio: null, portfolioName };
  }

  const portfolio = await resolveUserPortfolioByName(supabase, user.id, portfolioName);
  return { supabase, user, portfolio, portfolioName };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const context = await getAuthorizedPortfolio(searchParams.get("portfolioName"));

  if (!context.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  const recommendation = await getLatestPortfolioAIRecommendation(
    context.supabase,
    context.user.id,
    context.portfolio.id,
  );

  return NextResponse.json({ recommendation });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalyzeRequestBody;
  const context = await getAuthorizedPortfolio(body.portfolioName);

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

  try {
    const response = await fetch(`${backendBaseUrl()}/api/evaluate`, {
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

    const payload = (await response.json().catch(() => null)) as BackendEvaluationResponse | null;

    if (!response.ok) {
      const detail =
        (payload as { detail?: string } | null)?.detail ||
        payload?.data?.message ||
        "AI analysis backend request failed.";

      return NextResponse.json({ error: detail }, { status: response.status });
    }

    if (payload?.status !== "success" || !payload.data?.final_decision) {
      return NextResponse.json(
        { error: payload?.data?.message || "AI analysis did not return a final recommendation." },
        { status: 502 }
      );
    }

    const recommendation: PortfolioAIRecommendation = {
      action: payload.data.final_decision.action,
      confidence: payload.data.final_decision.confidence,
      summary: payload.data.final_decision.summary,
      reasoning: payload.data.final_decision.reasoning,
      portfolioActions: payload.data.final_decision.portfolio_actions,
      analyzedAt: payload.data.meta?.as_of || new Date().toISOString(),
      snapshotTimestamp: snapshot.summary.timestamp,
      evidence: buildPortfolioAIEvidence(snapshot),
      signals: [
        {
          label: "TA",
          tone: normalizeSignalTone("TA", payload.data.components?.ta_result?.portfolio_trend),
          summary:
            payload.data.components?.ta_result
              ? `${payload.data.components.ta_result.portfolio_trend} trend with signal strength ${payload.data.components.ta_result.signal_strength}/10.`
              : "Technical analysis output is unavailable for this run.",
        },
        {
          label: "News / Market",
          tone: normalizeSignalTone("News / Market", payload.data.components?.news_market_result?.market_bias),
          summary:
            payload.data.components?.news_market_result?.narrative_summary ||
            "Market narrative is neutral due to limited external context.",
        },
        {
          label: "Risk",
          tone: normalizeSignalTone("Risk", payload.data.components?.risk_result?.risk_level),
          summary:
            payload.data.components?.risk_result
              ? `${payload.data.components.risk_result.risk_level} risk with ${payload.data.components.risk_result.capital_preservation_bias.toLowerCase()} preservation bias.`
              : "Risk output is unavailable for this run.",
        },
      ],
    };

    await savePortfolioAIRecommendation(supabase, user.id, portfolio.id, recommendation);

    return NextResponse.json({ recommendation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach AI backend.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
