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

function backendBaseUrl(): string {
  return process.env.AI_BACKEND_URL?.trim() || process.env.BACKEND_API_URL?.trim() || DEFAULT_BACKEND_URL;
}

async function fetchConnectedPortfolioPositions(mode: "demo" | "testnet" = "demo"): Promise<PortfolioPosition[] | null> {
  try {
    const response = await fetch(`${backendBaseUrl()}/api/binance/connection/preview`, {
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
          data?: {
            assets?: Array<{
              asset?: string;
              quantity?: number;
              price_usd?: number;
              is_stablecoin?: boolean;
            }>;
          };
        }
      | null;

    const assets = payload?.data?.assets ?? [];
    if (!Array.isArray(assets) || assets.length === 0) {
      return [];
    }

    const positions: PortfolioPosition[] = [];
    for (const asset of assets) {
      const symbolAsset = `${asset.asset ?? ""}`.trim().toUpperCase();
      const quantity = Number(asset.quantity ?? 0);
      const priceUsd = Number(asset.price_usd ?? 0);
      const isStablecoin = Boolean(asset.is_stablecoin);

      if (!symbolAsset || !Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }

      const symbol = isStablecoin ? symbolAsset : `${symbolAsset}USDT`;
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

  const liveConnectedPositions = portfolio.mode === "binance_connected"
    ? await fetchConnectedPortfolioPositions("demo")
    : null;

  const positions = portfolio.mode === "binance_connected"
    ? (liveConnectedPositions ?? getBinanceConnectedSeedPositions())
    : (positionsOverride && positionsOverride.length > 0 ? positionsOverride : positionsOverride ?? undefined);

  try {
    const snapshot = await buildBinancePortfolioSnapshot(name, positions ?? undefined);
    const nowIso = new Date().toISOString();
    const riskProfile = await getActiveRiskProfileByPortfolio(supabase, user.id, portfolio.id);
    let riskViolations: PortfolioRiskViolation[] = [];

    if (riskProfile) {
      const limits = await listRiskLimitsByProfile(supabase, user.id, riskProfile.id);
      const effectiveProfile = applyRiskLimitOverrides(riskProfile, limits);
      const violations = evaluateRiskViolations(snapshot, effectiveProfile);

      if (violations.length > 0) {
        await logRiskViolations(supabase, user.id, portfolio.id, effectiveProfile.id, violations);
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

    await savePortfolioSnapshotCache(supabase, user.id, portfolio.id, snapshotWithRisk);

    if (portfolio.mode === "binance_connected") {
      await updatePortfolioConnectionSyncState(supabase, user.id, portfolio.id, "active", nowIso);
    }

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
