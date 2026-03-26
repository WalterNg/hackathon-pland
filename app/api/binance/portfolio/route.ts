import { NextResponse } from "next/server";

import { buildBinancePortfolioSnapshot } from "@/app/lib/binance-portfolio";
import type { PortfolioPosition, PortfolioRiskViolation } from "@/app/lib/portfolio-types";
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
import {
  getBinanceConnectedSeedPositions,
  resolveUserPortfolioByName,
  updatePortfolioConnectionSyncState
} from "@/app/lib/repositories/portfolios-repo";

export const dynamic = "force-dynamic";
const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";
const CONNECTED_PORTFOLIO_SYNC_INTERVAL_MS = 30_000;

function backendBaseUrl(): string {
  return process.env.AI_BACKEND_URL?.trim() || process.env.BACKEND_API_URL?.trim() || DEFAULT_BACKEND_URL;
}

function isSnapshotFresh(snapshot: { summary: { timestamp: string } } | null, maxAgeMs: number): boolean {
  if (!snapshot) {
    return false;
  }

  const timestampMs = new Date(snapshot.summary.timestamp).getTime();
  if (!Number.isFinite(timestampMs)) {
    return false;
  }

  return Date.now() - timestampMs < maxAgeMs;
}

async function fetchConnectedPortfolioPositions(mode: "demo" | "testnet" = "demo"): Promise<PortfolioPosition[] | null> {
  try {
    const response = await fetch(`${backendBaseUrl()}/api/binance/connection/positions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        mode,
        include_zero_balances: false,
        recv_window_ms: 5000
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as
      | {
          data?: Array<{
            symbol?: string;
            quantity?: number;
            avg_buy_price_usd?: number;
          }>;
        }
      | null;

    const items = payload?.data ?? [];
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const positions: PortfolioPosition[] = [];
    for (const item of items) {
      const symbol = `${item.symbol ?? ""}`.trim().toUpperCase();
      const quantity = Number(item.quantity ?? 0);
      const priceUsd = Number(item.avg_buy_price_usd ?? 0);

      if (!symbol || !Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }

      positions.push({
        symbol,
        quantity,
        avgBuyPriceUsd: Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : 1
      });
    }

    return positions;
  } catch {
    return null;
  }
}

async function buildAndCachePortfolioSnapshot(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  portfolio: NonNullable<Awaited<ReturnType<typeof resolveUserPortfolioByName>>>,
  portfolioName: string,
  positionsOverride: PortfolioPosition[] | null
) {
  const liveConnectedPositions = portfolio.mode === "binance_connected"
    ? await fetchConnectedPortfolioPositions("demo")
    : null;

  const positions = portfolio.mode === "binance_connected"
    ? (liveConnectedPositions ?? getBinanceConnectedSeedPositions())
    : (positionsOverride && positionsOverride.length > 0 ? positionsOverride : positionsOverride ?? undefined);

  const snapshot = await buildBinancePortfolioSnapshot(portfolioName, positions ?? undefined);
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

  if (portfolio.mode === "binance_connected") {
    await updatePortfolioConnectionSyncState(supabase, userId, portfolio.id, "active", nowIso);
  }

  return snapshotWithRisk;
}

function snapshotHeaders(
  portfolioMode: "manual" | "binance_connected",
  source: string,
  isStale = false
) {
  return {
    "x-portfolio-mode": portfolioMode,
    "x-snapshot-source": source,
    "x-snapshot-stale": String(isStale)
  };
}

async function getRequestContext(request: Request) {
  if (!hasSupabaseEnv()) {
    return { error: NextResponse.json({ error: "Supabase environment is required." }, { status: 500 }) };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

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
    positionsOverride
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
      headers: snapshotHeaders(context.portfolio.mode, "cache", !isFresh)
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
      headers: snapshotHeaders(context.portfolio.mode, "live")
    });
  } catch {
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: snapshotHeaders(context.portfolio.mode, "cache-fallback")
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
    const snapshotWithRisk = await buildAndCachePortfolioSnapshot(
      supabase,
      user.id,
      portfolio,
      name,
      positionsOverride
    );

    return NextResponse.json(snapshotWithRisk, {
      status: 200,
      headers: snapshotHeaders(portfolio.mode, "live")
    });
  } catch {
    const cached = await getLatestPortfolioSnapshotCache(supabase, user.id, portfolio.id);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: snapshotHeaders(portfolio.mode, "cache-fallback")
      });
    }

    return NextResponse.json({ error: "Live market provider is unavailable." }, { status: 502 });
  }
}
