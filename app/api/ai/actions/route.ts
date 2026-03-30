import { NextResponse } from "next/server";

import { getActiveRiskProfileByPortfolio, logRiskEvent } from "@/app/lib/repositories/risk-repo";
import { resolveUserPortfolioByName } from "@/app/lib/repositories/portfolios-repo";
import type { RiskSeverity } from "@/app/lib/risk-types";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";

type ActionType = "sell_intent_opened" | "protective_rules_applied" | "alert_center_opened";

type Payload = {
  portfolioName?: string;
  actionType?: ActionType;
  severity?: RiskSeverity;
  title?: string;
  message?: string;
  symbol?: string;
  details?: Record<string, unknown>;
};

function isActionType(value: string | undefined): value is ActionType {
  return value === "sell_intent_opened" || value === "protective_rules_applied" || value === "alert_center_opened";
}

function isRiskSeverity(value: string | undefined): value is RiskSeverity {
  return value === "info" || value === "warning" || value === "critical";
}

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseAuthContext(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as Payload | null;
  const portfolioName = payload?.portfolioName?.trim() || "Main Portfolio";

  if (!isActionType(payload?.actionType)) {
    return NextResponse.json({ error: "Invalid AI action type." }, { status: 400 });
  }

  const severity: RiskSeverity = isRiskSeverity(payload?.severity) ? payload.severity : "info";
  const portfolio = await resolveUserPortfolioByName(supabase, user.id, portfolioName);
  if (!portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  const profile = await getActiveRiskProfileByPortfolio(supabase, user.id, portfolio.id);
  const result = await logRiskEvent(supabase, user.id, {
    portfolioId: portfolio.id,
    riskProfileId: profile?.id,
    eventType: `ai_${payload.actionType}`,
    severity,
    details: {
      title: payload?.title ?? "AI recommendation action",
      message: payload?.message ?? "AI recommendation action was initiated.",
      symbol: payload?.symbol ?? null,
      ...(payload?.details ?? {}),
    },
  });

  if (result.error) {
    return NextResponse.json({ error: "Unable to log AI action." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}