import { NextResponse } from "next/server";
import {
  listRiskAlertsByPortfolioIds,
  listRecentRiskEventsByPortfolioIds,
  parseRiskAlertStatus,
} from "@/app/lib/repositories/risk-repo";
import { listUserPortfolios } from "@/app/lib/repositories/portfolios-repo";
import type { AggregatedRiskAlertSummary, RiskAlertGroup } from "@/app/lib/risk-types";
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
  const status = parseRiskAlertStatus(searchParams.get("status"));
  const portfolios = await listUserPortfolios(supabase, user.id);
  const childPortfolios = portfolios.filter((portfolio) => !portfolio.isDefault);
  const childPortfolioIds = childPortfolios.map((portfolio) => portfolio.id);

  if (childPortfolioIds.length === 0) {
    const emptySummary: AggregatedRiskAlertSummary = {
      criticalActiveAlerts: 0,
      otherActiveAlerts: 0,
      recentRiskEvents: 0,
      childPortfolioCount: 0,
      portfoliosWithAlerts: 0,
    };

    return NextResponse.json({ summary: emptySummary, groups: [] satisfies RiskAlertGroup[] });
  }

  const [activeAlerts, filteredAlerts, recentEvents] = await Promise.all([
    listRiskAlertsByPortfolioIds(supabase, user.id, childPortfolioIds, "active", 400),
    listRiskAlertsByPortfolioIds(supabase, user.id, childPortfolioIds, status, 400),
    listRecentRiskEventsByPortfolioIds(supabase, user.id, childPortfolioIds, 20),
  ]);

  const portfolioNameById = new Map(childPortfolios.map((portfolio) => [portfolio.id, portfolio.name]));
  const alertsByPortfolioId = new Map<string, typeof filteredAlerts>();

  for (const alert of filteredAlerts) {
    if (!alert.portfolioId) {
      continue;
    }

    const currentAlerts = alertsByPortfolioId.get(alert.portfolioId) ?? [];
    currentAlerts.push(alert);
    alertsByPortfolioId.set(alert.portfolioId, currentAlerts);
  }

  const groups: RiskAlertGroup[] = childPortfolios
    .map((portfolio) => {
      const alerts = alertsByPortfolioId.get(portfolio.id) ?? [];
      const activeAlertCount = activeAlerts.filter((alert) => alert.portfolioId === portfolio.id).length;
      const activeCriticalCount = activeAlerts.filter(
        (alert) => alert.portfolioId === portfolio.id && alert.severity === "critical"
      ).length;

      return {
        portfolioId: portfolio.id,
        portfolioName: portfolioNameById.get(portfolio.id) ?? portfolio.name,
        activeCriticalCount,
        activeAlertCount,
        alerts,
      };
    })
    .filter((group) => group.alerts.length > 0);

  const summary: AggregatedRiskAlertSummary = {
    criticalActiveAlerts: activeAlerts.filter((alert) => alert.severity === "critical").length,
    otherActiveAlerts: activeAlerts.filter((alert) => alert.severity !== "critical").length,
    recentRiskEvents: recentEvents.length,
    childPortfolioCount: childPortfolios.length,
    portfoliosWithAlerts: groups.length,
  };

  return NextResponse.json({ summary, groups });
}