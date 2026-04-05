import { NextResponse } from "next/server";

import { buildBinancePortfolioSnapshot } from "@/app/lib/binance-portfolio";
import { deriveRecommendationMetadata } from "@/app/lib/portfolio-ai-actions";
import { buildPortfolioAIEvidence } from "@/app/lib/portfolio-ai-evidence";
import type { PortfolioAIRecommendation } from "@/app/lib/portfolio-types";
import type { TradingAgentResult } from "@/app/lib/trading-agent-types";
import { savePortfolioAIRecommendation } from "@/app/lib/repositories/portfolio-ai-recommendations-repo";
import { getActiveRiskProfileByPortfolio, listRiskAlerts } from "@/app/lib/repositories/risk-repo";
import { getUserPortfolioPositions } from "@/app/lib/repositories/portfolio-repo";
import { resolveUserPortfolioByName } from "@/app/lib/repositories/portfolios-repo";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

type AnalyzeRequestBody = {
  portfolioName?: string;
};

type BackendStreamError = {
  status?: string;
  message?: string;
};

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";
const WORKFLOW_VERSION = "trading_agent_v1";
const STABLE_VALUE_SYMBOLS = new Set(["USDT", "USDC", "FDUSD", "BUSD", "USDS", "TUSD"]);

function backendBaseUrl(): string {
  return process.env.AI_BACKEND_URL?.trim() || process.env.BACKEND_API_URL?.trim() || DEFAULT_BACKEND_URL;
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

async function getAuthorizedPortfolio(request: Request, portfolioNameInput?: string | null) {
  const { supabase, user } = await getAuthContext(request);
  const portfolioName = portfolioNameInput?.trim() || DEFAULT_PORTFOLIO_NAME;

  if (!user?.id) {
    return { supabase, user, portfolio: null, portfolioName };
  }

  const portfolio = await resolveUserPortfolioByName(supabase, user.id, portfolioName);
  return { supabase, user, portfolio, portfolioName };
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

function recommendationPortfolioId(portfolioId: string): string {
  return `${portfolioId}::${WORKFLOW_VERSION}`;
}

function buildTradingAgentPortfolioInput(
  positions: Array<{ symbol: string; quantity: number }>,
  snapshot: Awaited<ReturnType<typeof buildBinancePortfolioSnapshot>>
) {
  let stablecoinReserve = 0;

  const portfolioItems = positions
    .map((position) => {
      const normalizedSymbol = position.symbol.toUpperCase().trim();
      const assetRow = snapshot.assets.find((asset) => asset.symbol === position.symbol);
      if (!assetRow || assetRow.priceUsd <= 0) {
        return null;
      }

      if (STABLE_VALUE_SYMBOLS.has(normalizedSymbol)) {
        stablecoinReserve += position.quantity * assetRow.priceUsd;
        return null;
      }

      return {
        asset: position.symbol,
        amount: position.quantity,
        current_price: assetRow.priceUsd,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    portfolioItems,
    stablecoinReserve,
  };
}

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n"),
  };
}

function buildRecommendation(
  payload: TradingAgentResult,
  snapshot: Awaited<ReturnType<typeof buildBinancePortfolioSnapshot>>,
  activeAlerts: Awaited<ReturnType<typeof listRiskAlerts>>,
  activeRiskProfile: Awaited<ReturnType<typeof getActiveRiskProfileByPortfolio>>
): PortfolioAIRecommendation {
  const recommendationBase: PortfolioAIRecommendation = {
    action: payload.final_decision?.action ?? "Hold",
    confidence: payload.final_decision?.confidence ?? 5,
    summary: payload.final_decision?.summary ?? "Trading agent completed without a final summary.",
    reasoning: payload.final_decision?.reasoning ?? ["Trading agent did not return reasoning."],
    portfolioActions: payload.final_decision?.portfolio_actions ?? [],
    analyzedAt: payload.meta?.as_of || new Date().toISOString(),
    snapshotTimestamp: snapshot.summary.timestamp,
    evidence: buildPortfolioAIEvidence(snapshot),
    workflowVersion: payload.workflow_version || WORKFLOW_VERSION,
    signals: [
      {
        label: "TA",
        tone: normalizeSignalTone("TA", payload.analyst_reports?.technical?.portfolio_trend),
        summary: payload.analyst_reports?.technical?.summary || "Technical analyst output was not available for this run.",
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
        summary: payload.risk_debate?.judge_summary || "Risk debate summary was not available for this run.",
      },
    ],
  };

  return {
    ...recommendationBase,
    metadata: deriveRecommendationMetadata(recommendationBase, activeAlerts, activeRiskProfile),
  };
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

  const { portfolioItems, stablecoinReserve } = buildTradingAgentPortfolioInput(positions, snapshot);

  if (portfolioItems.length === 0 && stablecoinReserve <= 0) {
    return NextResponse.json({ error: "Unable to build a live market snapshot for this portfolio." }, { status: 502 });
  }

  const backendResponse = await fetch(`${backendBaseUrl()}/api/trading-agent/evaluate/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      user_id: user.id,
      portfolio: portfolioItems,
      stablecoin_reserve: stablecoinReserve,
      news_headlines: [],
      social_dominance: 0,
    }),
  });

  if (!backendResponse.ok || !backendResponse.body) {
    const payload = (await backendResponse.json().catch(() => null)) as BackendStreamError | null;
    return NextResponse.json(
      {
        error: payload?.message || "Trading agent stream failed to start.",
      },
      { status: backendResponse.ok ? 502 : backendResponse.status }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = backendResponse.body?.getReader();
      if (!reader) {
        controller.enqueue(encoder.encode(sse("error", { status: "error", message: "Trading agent stream body was unavailable." })));
        controller.close();
        return;
      }

      let buffer = "";

      const emit = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)));
      };

      const handleBlock = async (block: string) => {
        const parsed = parseSseBlock(block);
        if (!parsed) {
          return;
        }

        const payload = JSON.parse(parsed.data) as
          | TradingAgentResult
          | BackendStreamError
          | { status: string; workflow_version: string }
          | Record<string, unknown>;

        if (parsed.event === "done") {
          const result = payload as TradingAgentResult;
          if (result.status !== "success" || !result.final_decision) {
            emit("error", {
              status: "error",
              message: result.error || "Trading agent finished without a final decision.",
            });
            return;
          }

          const recommendation = buildRecommendation(result, snapshot, activeAlerts, activeRiskProfile);
          await savePortfolioAIRecommendation(
            supabase,
            user.id,
            recommendationPortfolioId(portfolio.id),
            recommendation
          );

          emit("done", {
            recommendation,
            workflowVersion: recommendation.workflowVersion || WORKFLOW_VERSION,
            warning: result.warnings?.[0] ?? null,
            result,
          });
          return;
        }

        emit(parsed.event, payload);
      };

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          let separatorIndex = buffer.indexOf("\n\n");
          while (separatorIndex !== -1) {
            const block = buffer.slice(0, separatorIndex).trim();
            buffer = buffer.slice(separatorIndex + 2);
            if (block) {
              await handleBlock(block);
            }
            separatorIndex = buffer.indexOf("\n\n");
          }
        }

        const trailingBlock = buffer.trim();
        if (trailingBlock) {
          await handleBlock(trailingBlock);
        }
      } catch (error) {
        emit("error", {
          status: "error",
          message: error instanceof Error ? error.message : "Trading agent stream failed.",
        });
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
