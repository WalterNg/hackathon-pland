import { NextResponse } from "next/server";
import {
  getActiveRiskProfileByPortfolio,
  getExactRiskProfileByPortfolio,
  isValidRiskRulesInput,
  parseRiskRulesInput,
  upsertPortfolioRiskProfile,
} from "@/app/lib/repositories/risk-repo";
import { resolveUserPortfolioByName } from "@/app/lib/repositories/portfolios-repo";
import type { RiskRuleSource } from "@/app/lib/risk-types";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";

export const dynamic = "force-dynamic";

async function resolveRequestContext(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization) {
    return { supabase: null, user: null, portfolio: null };
  }

  const { supabase, user } = await getSupabaseAuthContext(request);
  if (!user?.id) {
    return { supabase, user: null, portfolio: null };
  }

  const { searchParams } = new URL(request.url);
  const portfolioName = searchParams.get("portfolioName")?.trim() || "Main Portfolio";
  const portfolio = await resolveUserPortfolioByName(supabase, user.id, portfolioName);

  return { supabase, user, portfolio };
}

export async function GET(request: Request) {
  const { supabase, user, portfolio } = await resolveRequestContext(request);
  if (!supabase || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  const exactProfile = await getExactRiskProfileByPortfolio(supabase, user.id, portfolio.id);
  const activeProfile = exactProfile ?? (await getActiveRiskProfileByPortfolio(supabase, user.id, portfolio.id));
  const source: RiskRuleSource = exactProfile ? "portfolio" : activeProfile ? "global" : "none";

  return NextResponse.json({
    profile: activeProfile,
    source,
  });
}

export async function PUT(request: Request) {
  const { supabase, user, portfolio } = await resolveRequestContext(request);
  if (!supabase || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input = parseRiskRulesInput(payload);
  if (!isValidRiskRulesInput(input)) {
    return NextResponse.json({ error: "Risk rule values must be valid positive numbers or empty." }, { status: 400 });
  }

  const savedProfile = await upsertPortfolioRiskProfile(supabase, user.id, portfolio.id, input);
  if (!savedProfile) {
    return NextResponse.json({ error: "Unable to save risk rules." }, { status: 500 });
  }

  return NextResponse.json({ profile: savedProfile, source: "portfolio" satisfies RiskRuleSource });
}
