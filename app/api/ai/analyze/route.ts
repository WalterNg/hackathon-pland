import { NextResponse } from "next/server";

import { buildBinancePortfolioSnapshot } from "@/app/lib/binance-portfolio";
import { deriveRecommendationMetadata } from "@/app/lib/portfolio-ai-actions";
import { buildPortfolioAIEvidence } from "@/app/lib/portfolio-ai-evidence";
import type { PortfolioAIRecommendation } from "@/app/lib/portfolio-types";
import { getActiveRiskProfileByPortfolio, listRiskAlerts } from "@/app/lib/repositories/risk-repo";
import {
  getLatestPortfolioAIRecommendation,
  savePortfolioAIRecommendation,
} from "@/app/lib/repositories/portfolio-ai-recommendations-repo";
import { getUserPortfolioPositions } from "@/app/lib/repositories/portfolio-repo";
import { resolveUserPortfolioByName } from "@/app/lib/repositories/portfolios-repo";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

type AnalyzeRequestBody = {
  portfolioName?: string;
  portfolioUiSessionId?: string | null;
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
const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";

const clampConfidence = (value: number) => Math.max(1, Math.min(10, Math.round(value)));

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

function buildBackendFallbackWarning(detail: string): string {
  const suffix = detail.trim() ? ` Details: ${detail}` : "";
  return (
    "Advanced AI backend is unavailable, so this recommendation uses a local portfolio heuristic based on the latest Binance snapshot." +
    suffix
  );
}

function buildFallbackRecommendation(
  portfolioName: string,
  snapshot: Awaited<ReturnType<typeof buildBinancePortfolioSnapshot>>,
  alerts: Awaited<ReturnType<typeof listRiskAlerts>>,
  profile: Awaited<ReturnType<typeof getActiveRiskProfileByPortfolio>>,
): PortfolioAIRecommendation {
  const sortedAssets = [...snapshot.assets].sort((left, right) => right.allocationPercent - left.allocationPercent);
  const topAsset = sortedAssets[0] ?? null;
  const secondAsset = sortedAssets[1] ?? null;
  const weighted24hChange = snapshot.assets.reduce(
    (total, asset) => total + asset.change24hPercent * (asset.allocationPercent / 100),
    0
  );
  const weighted7dChange = snapshot.assets.reduce(
    (total, asset) => total + asset.change7dPercent * (asset.allocationPercent / 100),
    0
  );
  const riskScore = snapshot.metrics.riskScore ?? 50;
  const maxDrawdown = snapshot.metrics.maxDrawdownPercent ?? 0;
  const concentrationIndex = snapshot.metrics.concentrationIndex ?? 0;
  const allTimeProfit = snapshot.metrics.allTimeProfitPercent;
  const criticalViolations = snapshot.riskViolations?.filter((violation) => violation.severity === "critical").length ?? 0;
  const violatedRulesCount = snapshot.metrics.violatedRulesCount ?? snapshot.riskViolations?.length ?? 0;

  const taTone =
    weighted7dChange >= 3 || weighted24hChange >= 1.5
      ? "Bullish"
      : weighted7dChange <= -3 || weighted24hChange <= -1.5
        ? "Bearish"
        : "Neutral";

  const riskTone =
    criticalViolations > 0 || riskScore >= 75 || maxDrawdown >= 25
      ? "Defensive"
      : riskScore >= 55 || maxDrawdown >= 15 || concentrationIndex >= 3_000
        ? "Cautious"
        : "Neutral";

  let action: PortfolioAIRecommendation["action"] = "Hold";

  if (criticalViolations > 0 || maxDrawdown >= 35 || riskScore >= 85) {
    action = "Stop Loss";
  } else if (riskTone === "Defensive" || weighted24hChange <= -4) {
    action = "Reduce Risk";
  } else if ((topAsset?.allocationPercent ?? 0) >= 55 || concentrationIndex >= 4_500) {
    action = "Rebalance";
  } else if (taTone === "Bullish" && riskTone === "Neutral" && weighted7dChange >= 2) {
    action = "Accumulate";
  }

  const confidence = clampConfidence(
    5 +
      (taTone !== "Neutral" ? 1 : 0) +
      (riskTone !== "Neutral" ? 1 : 0) +
      (Math.abs(weighted24hChange) >= 3 || Math.abs(weighted7dChange) >= 6 ? 1 : 0)
  );

  const summaryByAction: Record<PortfolioAIRecommendation["action"], string> = {
    Accumulate: `Momentum remains constructive across ${portfolioName}, and current risk metrics still leave room to add exposure gradually.`,
    Hold: `The latest Binance snapshot for ${portfolioName} is mixed, so maintaining current exposure is the most balanced short-term stance.`,
    "Reduce Risk": `The latest snapshot shows weakening price action or rising portfolio risk, so trimming exposure is the prudent move for ${portfolioName}.`,
    Rebalance: `Portfolio concentration is elevated, so redistributing risk across positions is safer than adding new directional exposure right now.`,
    "Stop Loss": `Risk conditions have deteriorated enough that capital preservation should override directional conviction for ${portfolioName}.`,
  };

  const portfolioActionsByType: Record<PortfolioAIRecommendation["action"], string[]> = {
    Accumulate: [
      `Scale into ${topAsset?.symbol.replace("USDT", "") ?? "the strongest position"} in small increments instead of chasing size all at once.`,
      "Keep concentration below 55% even if the trend stays constructive.",
      "Review risk metrics again after the next major market move before adding more capital.",
    ],
    Hold: [
      "Keep current allocations unchanged until either trend strength or risk conditions become clearer.",
      `Monitor ${topAsset?.symbol.replace("USDT", "") ?? "the largest position"} closely because it remains the main driver of portfolio variance.`,
      "Wait for a stronger technical confirmation before increasing exposure.",
    ],
    "Reduce Risk": [
      `Trim the most volatile exposure first, starting with ${topAsset?.symbol.replace("USDT", "") ?? "the largest holding"} if it dominates portfolio risk.`,
      "Increase cash or stablecoin reserves until drawdown pressure cools off.",
      "Delay any fresh buys until risk score and short-term momentum improve.",
    ],
    Rebalance: [
      `Cut concentration in ${topAsset?.symbol.replace("USDT", "") ?? "the top holding"}${secondAsset ? ` and review the gap versus ${secondAsset.symbol.replace("USDT", "")}` : ""}.`,
      "Spread exposure more evenly across core positions instead of letting one asset dominate portfolio outcomes.",
      "Re-check allocation drift after the next price swing and rebalance again only if concentration stays elevated.",
    ],
    "Stop Loss": [
      "Prioritize capital preservation and reduce the highest-risk positions immediately.",
      "Avoid adding new exposure until drawdown and concentration metrics normalize.",
      "Re-enter only after the portfolio stabilizes and risk signals move out of the defensive zone.",
    ],
  };

  const recommendation: PortfolioAIRecommendation = {
    action,
    confidence,
    summary: summaryByAction[action],
    reasoning: [
      `Technical posture is ${taTone.toLowerCase()} with weighted 24h change at ${weighted24hChange.toFixed(2)}% and weighted 7d change at ${weighted7dChange.toFixed(2)}%.`,
      `Risk posture is ${riskTone.toLowerCase()} with risk score ${riskScore.toFixed(1)}/100, max drawdown ${maxDrawdown.toFixed(2)}%, and concentration index ${concentrationIndex.toFixed(0)}.`,
      violatedRulesCount > 0
        ? `${violatedRulesCount} risk rule${violatedRulesCount === 1 ? " is" : "s are"} currently flagged, including ${criticalViolations} critical violation${criticalViolations === 1 ? "" : "s"}.`
        : `No active risk violations are currently flagged, while all-time PnL stands at ${allTimeProfit.toFixed(2)}%.`,
    ],
    portfolioActions: portfolioActionsByType[action],
    signals: [
      {
        label: "TA",
        tone: taTone,
        summary: `Weighted portfolio momentum is ${weighted24hChange.toFixed(2)}% over 24h and ${weighted7dChange.toFixed(2)}% over 7d based on the current Binance snapshot.`,
      },
      {
        label: "News / Market",
        tone: "Neutral",
        summary: "External news and sentiment agents are unavailable for this run, so the recommendation is anchored to portfolio internals and live market pricing only.",
      },
      {
        label: "Risk",
        tone: riskTone,
        summary: `Risk score is ${riskScore.toFixed(1)}/100 with ${maxDrawdown.toFixed(2)}% max drawdown and ${topAsset?.allocationPercent.toFixed(2) ?? "0.00"}% in the largest position.`,
      },
    ],
    analyzedAt: new Date().toISOString(),
    snapshotTimestamp: snapshot.summary.timestamp,
    evidence: buildPortfolioAIEvidence(snapshot),
  };

  return {
    ...recommendation,
    metadata: deriveRecommendationMetadata(recommendation, alerts, profile),
  };
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

function normalizePortfolioUiSessionId(input: string | null | undefined): string | null {
  const value = input?.trim();
  return value ? value.slice(0, 128) : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const context = await getAuthorizedPortfolio(request, searchParams.get("portfolioName"));
  const portfolioUiSessionId = normalizePortfolioUiSessionId(searchParams.get("portfolioUiSessionId"));

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
    portfolioUiSessionId
  );

  return NextResponse.json({ recommendation });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalyzeRequestBody;
  const context = await getAuthorizedPortfolio(request, body.portfolioName);
  const portfolioUiSessionId = normalizePortfolioUiSessionId(body.portfolioUiSessionId);

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

      if (response.status >= 500) {
        return NextResponse.json({
          recommendation: buildFallbackRecommendation(portfolioName, snapshot, activeAlerts, activeRiskProfile),
          warning: buildBackendFallbackWarning(detail),
        });
      }

      return NextResponse.json({ error: detail }, { status: response.status });
    }

    if (payload?.status !== "success" || !payload.data?.final_decision) {
      return NextResponse.json({
        recommendation: buildFallbackRecommendation(portfolioName, snapshot, activeAlerts, activeRiskProfile),
        warning: buildBackendFallbackWarning(
          payload?.data?.message || "AI analysis did not return a final recommendation."
        ),
      });
    }

    const recommendationBase: PortfolioAIRecommendation = {
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
          summary: payload.data.components?.ta_result
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
          summary: payload.data.components?.risk_result
            ? `${payload.data.components.risk_result.risk_level} risk with ${payload.data.components.risk_result.capital_preservation_bias.toLowerCase()} preservation bias.`
            : "Risk output is unavailable for this run.",
        },
      ],
    };

    const recommendation: PortfolioAIRecommendation = {
      portfolioUiSessionId,
      ...recommendationBase,
      metadata: deriveRecommendationMetadata(recommendationBase, activeAlerts, activeRiskProfile),
    };

    await savePortfolioAIRecommendation(supabase, user.id, portfolio.id, recommendation);

    return NextResponse.json({ recommendation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach AI backend.";
    return NextResponse.json({
      recommendation: buildFallbackRecommendation(portfolioName, snapshot, activeAlerts, activeRiskProfile),
      warning: buildBackendFallbackWarning(message),
    });
  }
}
