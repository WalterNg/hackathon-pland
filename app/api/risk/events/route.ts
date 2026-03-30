import { NextResponse } from "next/server";
import {
  applyRiskLimitOverrides,
  getActiveRiskProfileByPortfolio,
  listRiskAlerts,
  listRecentRiskEvents,
  listRiskLimitsByProfile,
} from "@/app/lib/repositories/risk-repo";
import { resolveUserPortfolioByName } from "@/app/lib/repositories/portfolios-repo";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseAuthContext(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const portfolioName = searchParams.get("portfolioName")?.trim() || "Main Portfolio";
  const limitParam = Number(searchParams.get("limit") ?? 6);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 20) : 6;

  const portfolio = await resolveUserPortfolioByName(supabase, user.id, portfolioName);
  if (!portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  const profile = await getActiveRiskProfileByPortfolio(supabase, user.id, portfolio.id);
  let effectiveProfile = null;

  if (profile) {
    const limits = await listRiskLimitsByProfile(supabase, user.id, profile.id);
    effectiveProfile = applyRiskLimitOverrides(profile, limits);
  }

  const events = await listRecentRiskEvents(supabase, user.id, portfolio.id, limit);
  const alerts = await listRiskAlerts(supabase, user.id, portfolio.id, "active", limit);
  return NextResponse.json({ profile: effectiveProfile, events, alerts });
}
