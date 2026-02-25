import { NextResponse } from "next/server";

import { buildBinancePortfolioSnapshot } from "@/app/lib/binance-portfolio";
import {
  getLatestPortfolioSnapshotCache,
  savePortfolioSnapshotCache
} from "@/app/lib/repositories/portfolio-snapshots-repo";
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
    await savePortfolioSnapshotCache(supabase, user.id, portfolio.id, snapshot);
    return NextResponse.json(snapshot);
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
