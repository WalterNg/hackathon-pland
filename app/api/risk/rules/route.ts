import { NextResponse } from "next/server";
import {
  getGlobalRiskProfile,
  isValidRiskRulesInput,
  parseRiskRulesInput,
  upsertGlobalRiskProfile,
} from "@/app/lib/repositories/risk-repo";
import { resolveUserPortfolioByName } from "@/app/lib/repositories/portfolios-repo";
import type { RiskRuleSource } from "@/app/lib/risk-types";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";

export const dynamic = "force-dynamic";

const MAIN_PORTFOLIO_NAME = "Main Portfolio";

type RequestScope = "global" | "portfolio";

async function resolveRequestContext(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization) {
    return { supabase: null, user: null, portfolio: null };
  }

  const { supabase, user } = await getSupabaseAuthContext(request);
  if (!user?.id) {
    return { supabase, user: null, portfolio: null, portfolioName: MAIN_PORTFOLIO_NAME, scope: "portfolio" as RequestScope };
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "global" ? "global" : "portfolio";
  const portfolioName = searchParams.get("portfolioName")?.trim() || MAIN_PORTFOLIO_NAME;

  if (scope === "global") {
    return { supabase, user, portfolio: null, portfolioName, scope };
  }

  const portfolio = await resolveUserPortfolioByName(supabase, user.id, portfolioName);

  return { supabase, user, portfolio, portfolioName, scope };
}

export async function GET(request: Request) {
  const { supabase, user, portfolio, scope } = await resolveRequestContext(request);
  if (!supabase || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (scope === "portfolio" && !portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  const activeProfile = await getGlobalRiskProfile(supabase, user.id);
  const source: RiskRuleSource = activeProfile ? "global" : "none";

  return NextResponse.json({
    profile: activeProfile,
    source,
  });
}

export async function PUT(request: Request) {
  const { supabase, user, portfolioName, scope } = await resolveRequestContext(request);
  if (!supabase || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canSaveGlobalRules = scope === "global" || portfolioName === MAIN_PORTFOLIO_NAME;
  if (!canSaveGlobalRules) {
    return NextResponse.json(
      { error: "Portfolio-specific rules are no longer supported. Update global rules from Main Portfolio." },
      { status: 400 }
    );
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input = parseRiskRulesInput(payload);
  if (!isValidRiskRulesInput(input)) {
    return NextResponse.json({ error: "Risk rule values must be valid positive numbers or empty." }, { status: 400 });
  }

  const savedProfile = await upsertGlobalRiskProfile(supabase, user.id, input);
  if (!savedProfile) {
    return NextResponse.json({ error: "Unable to save risk rules." }, { status: 500 });
  }

  return NextResponse.json({ profile: savedProfile, source: "global" satisfies RiskRuleSource });
}
