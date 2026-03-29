import { NextResponse } from "next/server";
import { hasSupabaseServiceEnv } from "@/app/lib/supabase/env";
import { createSupabaseServiceClient } from "@/app/lib/supabase/service";
import { resolveMarketPrice } from "@/app/lib/repositories/market-data-repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json({ error: "Supabase service role environment variable is missing." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase() || "";
  const fallbackPriceUsdParam = Number(searchParams.get("fallbackPriceUsd") ?? NaN);
  const fallbackPriceUsd =
    Number.isFinite(fallbackPriceUsdParam) && fallbackPriceUsdParam > 0 ? fallbackPriceUsdParam : null;

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const result = await resolveMarketPrice(supabase, symbol, fallbackPriceUsd);

  if (!result.price) {
    return NextResponse.json({ error: "Unable to resolve price.", source: result.source }, { status: 200 });
  }

  return NextResponse.json({ ...result.price, source: result.source }, { status: 200 });
}