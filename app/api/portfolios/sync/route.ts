import { NextResponse } from "next/server";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";
import {
  resolveUserPortfolioByName,
  syncBinancePortfolio,
  type BinanceImportAsset,
} from "@/app/lib/repositories/portfolios-repo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseAuthContext(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    name?: string;
    assets?: BinanceImportAsset[];
  } | null;

  const portfolioName = payload?.name?.trim();
  if (!portfolioName) {
    return NextResponse.json({ error: "Portfolio name is required." }, { status: 400 });
  }

  const assets = Array.isArray(payload?.assets) ? payload.assets : [];
  if (assets.length === 0) {
    return NextResponse.json({ error: "No assets provided for sync." }, { status: 400 });
  }

  const portfolio = await resolveUserPortfolioByName(supabase, user.id, portfolioName);
  if (!portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  if (portfolio.mode !== "binance_connected") {
    return NextResponse.json({ error: "Portfolio is not a Binance-connected portfolio." }, { status: 400 });
  }

  const result = await syncBinancePortfolio(supabase, user.id, portfolio.id, assets);
  if (!result.ok) {
    return NextResponse.json({ error: "Failed to sync portfolio." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, adjustmentCount: result.adjustmentCount });
}
