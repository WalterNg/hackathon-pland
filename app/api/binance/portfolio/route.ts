import { NextResponse } from "next/server";

import { buildBinancePortfolioSnapshot } from "@/app/lib/binance-portfolio";
import type { PortfolioRiskViolation } from "@/app/lib/portfolio-types";
import {
  getLatestPortfolioSnapshotCache,
  savePortfolioSnapshotCache
} from "@/app/lib/repositories/portfolio-snapshots-repo";
import {
  applyRiskLimitOverrides,
  evaluateRiskViolations,
  getActiveRiskProfileByPortfolio,
  listRiskLimitsByProfile,
  logRiskViolations,
} from "@/app/lib/repositories/risk-repo";
import { hasSupabaseEnv } from "@/app/lib/supabase/env";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";
import { getUserPortfolioPositions } from "@/app/lib/repositories/portfolio-repo";
import { resolveUserPortfolioByName } from "@/app/lib/repositories/portfolios-repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase environment is required." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim() || "Main Portfolio";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const portfolio = await resolveUserPortfolioByName(supabase, user.id, name);
  if (!portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  const positionsOverride = await getUserPortfolioPositions(supabase, user.id, name);
  if (positionsOverride === null) {
    return NextResponse.json({ error: "Unable to resolve portfolio positions." }, { status: 500 });
  }

  try {
    const snapshot = await buildBinancePortfolioSnapshot(name, positionsOverride ?? undefined);
    const nowIso = new Date().toISOString();
    const riskProfile = await getActiveRiskProfileByPortfolio(supabase, user.id, portfolio.id);
    let riskViolations: PortfolioRiskViolation[] = [];

    if (riskProfile) {
      const limits = await listRiskLimitsByProfile(supabase, user.id, riskProfile.id);
      const effectiveProfile = applyRiskLimitOverrides(riskProfile, limits);
      const violations = evaluateRiskViolations(snapshot, effectiveProfile);
      await logRiskViolations(supabase, user.id, portfolio.id, effectiveProfile.id, violations);

      riskViolations = violations.map((violation) => ({
        eventType: violation.eventType,
        severity: violation.severity,
        title: violation.title,
        message: violation.message,
        observedValue: violation.observedValue,
        thresholdValue: violation.thresholdValue,
        symbol: violation.symbol,
        occurredAt: nowIso,
      }));
    }

    const snapshotWithRisk = {
      ...snapshot,
      metrics: {
        ...snapshot.metrics,
        violatedRulesCount: riskViolations.length,
        lastRiskUpdatedAt: nowIso,
      },
      riskViolations,
    };

    await savePortfolioSnapshotCache(supabase, user.id, portfolio.id, snapshotWithRisk);
    return NextResponse.json(snapshotWithRisk);
  } catch {
    const cached = await getLatestPortfolioSnapshotCache(supabase, user.id, portfolio.id);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: {
          "x-snapshot-source": "cache"
        }
      });
    }

    return NextResponse.json({ error: "Live market provider is unavailable." }, { status: 502 });
  }
}
