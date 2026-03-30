import { NextResponse } from "next/server";
import { listRiskAlerts, parseRiskAlertStatus } from "@/app/lib/repositories/risk-repo";
import { resolveUserPortfolioByName } from "@/app/lib/repositories/portfolios-repo";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, user } = await getSupabaseAuthContext(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const portfolioName = searchParams.get("portfolioName")?.trim() || "Main Portfolio";
  const status = parseRiskAlertStatus(searchParams.get("status"));
  const limitParam = Number(searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 100) : 20;

  const portfolio = await resolveUserPortfolioByName(supabase, user.id, portfolioName);
  if (!portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  const alerts = await listRiskAlerts(supabase, user.id, portfolio.id, status, limit);
  return NextResponse.json({ alerts });
}
