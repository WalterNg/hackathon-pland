import { NextResponse } from "next/server";

import { buildBinancePortfolioSnapshot } from "@/app/lib/binance-portfolio";
import type { PortfolioPosition, PortfolioRiskViolation } from "@/app/lib/portfolio-types";
import {
  getUserPortfolioPositions,
  upsertPortfolioAssetPriceCache,
} from "@/app/lib/repositories/portfolio-repo";
import {
  getLatestPortfolioSnapshotCache,
  savePortfolioSnapshotCache,
} from "@/app/lib/repositories/portfolio-snapshots-repo";
import {
  resolveUserPortfolioByName,
  updatePortfolioConnectionSyncState,
} from "@/app/lib/repositories/portfolios-repo";
import {
  applyRiskLimitOverrides,
  evaluateRiskViolations,
  getActiveRiskProfileByPortfolio,
  listRiskLimitsByProfile,
  logRiskViolations,
} from "@/app/lib/repositories/risk-repo";
import { hasSupabaseEnv, hasSupabaseServiceEnv } from "@/app/lib/supabase/env";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";
import { createSupabaseServiceClient } from "@/app/lib/supabase/service";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { refreshMarketPricesFromSnapshot } from "@/app/lib/repositories/market-data-repo";

export const dynamic = "force-dynamic";

const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";
const CONNECTED_PORTFOLIO_SYNC_INTERVAL_MS = 30_000;

type AuthContext = {
  supabase: SupabaseClient;
  user: User | null;
};

function isSnapshotFresh(snapshot: { summary: { timestamp: string } } | null, maxAgeMs: number): boolean {
  if (!snapshot) {
    return false;
  }

  const snapshotTime = new Date(snapshot.summary.timestamp).getTime();
  if (Number.isNaN(snapshotTime)) {
    return false;
  }

  return Date.now() - snapshotTime <= maxAgeMs;
}

async function getAuthContext(request: Request): Promise<AuthContext> {
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

async function buildAndCachePortfolioSnapshot(
  supabase: SupabaseClient,
  userId: string,
  portfolio: { id: string; mode: "manual" | "binance_connected" },
  portfolioName: string,
  positionsOverride: PortfolioPosition[]
) {
  const snapshot = await buildBinancePortfolioSnapshot(portfolioName, positionsOverride);
  const nowIso = new Date().toISOString();
  const riskProfile = await getActiveRiskProfileByPortfolio(supabase, userId, portfolio.id);
  let riskViolations: PortfolioRiskViolation[] = [];

  if (riskProfile) {
    const limits = await listRiskLimitsByProfile(supabase, userId, riskProfile.id);
    const effectiveProfile = applyRiskLimitOverrides(riskProfile, limits);
    const violations = evaluateRiskViolations(snapshot, effectiveProfile);

    if (violations.length > 0) {
      await logRiskViolations(supabase, userId, portfolio.id, effectiveProfile.id, violations);
    }

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

  await savePortfolioSnapshotCache(supabase, userId, portfolio.id, snapshotWithRisk);
  await upsertPortfolioAssetPriceCache(
    supabase,
    userId,
    portfolio.id,
    snapshot.assets.map((asset) => ({
      symbol: asset.symbol,
      quantity: asset.quantity,
      avgBuyPriceUsd: asset.avgBuyPriceUsd,
      priceUsd: asset.priceUsd
    }))
  );

  if (hasSupabaseServiceEnv()) {
    const marketSupabase = createSupabaseServiceClient();
    const marketPrices = snapshot.assets
      .filter((asset) => Number.isFinite(asset.priceUsd) && asset.priceUsd > 0)
      .map((asset) => ({
        symbol: asset.symbol,
        priceUsd: asset.priceUsd,
        source: "portfolio_snapshot"
      }));

    if (snapshot.summary.btcPriceUsd && snapshot.summary.btcPriceUsd > 0) {
      marketPrices.push({
        symbol: "BTCUSDT",
        priceUsd: snapshot.summary.btcPriceUsd,
        source: "portfolio_snapshot"
      });
    }

    await refreshMarketPricesFromSnapshot(marketSupabase, marketPrices);
  }

  if (portfolio.mode === "binance_connected") {
    await updatePortfolioConnectionSyncState(supabase, userId, portfolio.id, "active", nowIso);
  }

  return snapshotWithRisk;
}

function snapshotHeaders(portfolioMode: "manual" | "binance_connected", source: string, isStale = false) {
  return {
    "x-portfolio-mode": portfolioMode,
    "x-snapshot-source": source,
    "x-snapshot-stale": String(isStale),
  };
}

async function getRequestContext(request: Request) {
  if (!hasSupabaseEnv()) {
    return { error: NextResponse.json({ error: "Supabase environment is required." }, { status: 500 }) };
  }

  const { supabase, user } = await getAuthContext(request);
  if (!user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim() || DEFAULT_PORTFOLIO_NAME;
  const portfolio = await resolveUserPortfolioByName(supabase, user.id, name);

  if (!portfolio?.id) {
    return { error: NextResponse.json({ error: "Portfolio not found." }, { status: 404 }) };
  }

  const positionsOverride = await getUserPortfolioPositions(supabase, user.id, name);
  if (positionsOverride === null) {
    return { error: NextResponse.json({ error: "Unable to resolve portfolio positions." }, { status: 500 }) };
  }

  return {
    supabase,
    userId: user.id,
    name,
    portfolio,
    positionsOverride,
  };
}

export async function GET(request: Request) {
  const context = await getRequestContext(request);
  if ("error" in context) {
    return context.error;
  }

  const cached = await getLatestPortfolioSnapshotCache(context.supabase, context.userId, context.portfolio.id);
  if (context.portfolio.mode === "binance_connected" && cached) {
    const isFresh = isSnapshotFresh(cached, CONNECTED_PORTFOLIO_SYNC_INTERVAL_MS);
    return NextResponse.json(cached, {
      status: 200,
      headers: snapshotHeaders(context.portfolio.mode, "cache", !isFresh),
    });
  }

  try {
    const snapshotWithRisk = await buildAndCachePortfolioSnapshot(
      context.supabase,
      context.userId,
      context.portfolio,
      context.name,
      context.positionsOverride
    );

    return NextResponse.json(snapshotWithRisk, {
      status: 200,
      headers: snapshotHeaders(context.portfolio.mode, "live"),
    });
  } catch {
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: snapshotHeaders(context.portfolio.mode, "cache-fallback"),
      });
    }

    return NextResponse.json({ error: "Live market provider is unavailable." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase environment is required." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim() || DEFAULT_PORTFOLIO_NAME;
  const authContext = await getAuthContext(request);

  if (!authContext.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, user } = authContext;
  const portfolio = await resolveUserPortfolioByName(supabase, user.id, name);
  if (!portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  const positionsOverride = await getUserPortfolioPositions(supabase, user.id, name);
  if (positionsOverride === null) {
    return NextResponse.json({ error: "Unable to resolve portfolio positions." }, { status: 500 });
  }

  try {
    const snapshotWithRisk = await buildAndCachePortfolioSnapshot(
      supabase,
      user.id,
      portfolio,
      name,
      positionsOverride
    );

    return NextResponse.json(snapshotWithRisk, {
      status: 200,
      headers: snapshotHeaders(portfolio.mode, "live"),
    });
  } catch {
    const cached = await getLatestPortfolioSnapshotCache(supabase, user.id, portfolio.id);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: snapshotHeaders(portfolio.mode, "cache-fallback"),
      });
    }

    return NextResponse.json({ error: "Live market provider is unavailable." }, { status: 502 });
  }
}
