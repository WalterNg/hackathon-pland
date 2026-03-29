import { NextResponse } from "next/server";
import { hasSupabaseServiceEnv } from "@/app/lib/supabase/env";
import { createSupabaseServiceClient } from "@/app/lib/supabase/service";
import { resolveMarketSymbols } from "@/app/lib/repositories/market-data-repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json({ symbols: [], source: "missing-env", refreshedAt: null }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toUpperCase() || "";
  const supabase = createSupabaseServiceClient();

  const result = await resolveMarketSymbols(supabase, query);
  return NextResponse.json(result, { status: 200 });
}
