import { NextResponse } from "next/server";

import {
  listPortfolioAIRecommendationHistory,
} from "@/app/lib/repositories/portfolio-ai-recommendations-repo";
import { getAuthorizedPortfolio, normalizePortfolioUiSessionId } from "../shared";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 25;

function parsePositiveInteger(value: string | null | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInteger(searchParams.get("page"), DEFAULT_PAGE);
  const pageSize = Math.min(parsePositiveInteger(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const portfolioUiSessionId = normalizePortfolioUiSessionId(searchParams.get("portfolioUiSessionId"));
  const context = await getAuthorizedPortfolio(request, searchParams.get("portfolioName"));

  if (!context.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  try {
    const history = await listPortfolioAIRecommendationHistory(
      context.supabase,
      context.user.id,
      context.portfolio.id,
      page,
      pageSize,
      portfolioUiSessionId
    );

    return NextResponse.json({
      ...history,
      portfolioName: context.portfolioName,
      portfolioUiSessionId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load AI recommendation history.",
      },
      { status: 500 }
    );
  }
}
