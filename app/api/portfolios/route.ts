import { NextResponse } from "next/server";
import {
  createUserPortfolio,
  listUserPortfolios
} from "@/app/lib/repositories/portfolios-repo";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getAuthContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getAuthContext();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const portfolios = await listUserPortfolios(supabase, user.id);
  return NextResponse.json({ portfolios });
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthContext();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { name?: string } | null;
  const nextName = payload?.name ?? "";

  const { portfolio, errorCode } = await createUserPortfolio(supabase, user.id, nextName);

  if (errorCode === "invalid-name") {
    return NextResponse.json({ error: "Portfolio name is required." }, { status: 400 });
  }

  if (errorCode === "duplicate") {
    return NextResponse.json({ error: "Portfolio name already exists." }, { status: 409 });
  }

  if (errorCode || !portfolio) {
    return NextResponse.json({ error: "Unable to create portfolio." }, { status: 500 });
  }

  return NextResponse.json({ portfolio }, { status: 201 });
}