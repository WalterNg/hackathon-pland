import { NextResponse } from "next/server";
import {
  createUserPortfolio,
  deleteUserPortfolio,
  listUserPortfolios,
  type BinanceImportAsset
} from "@/app/lib/repositories/portfolios-repo";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";

export const dynamic = "force-dynamic";

async function getAuthContext(request: Request) {
  return getSupabaseAuthContext(request);
}

export async function GET(request: Request) {
  const { supabase, user } = await getAuthContext(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const portfolios = await listUserPortfolios(supabase, user.id);
  return NextResponse.json({ portfolios });
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthContext(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    name?: string;
    mode?: "manual" | "binance_connected";
    idempotencyKey?: string;
    assets?: BinanceImportAsset[];
  } | null;
  const nextName = payload?.name ?? "";
  const nextMode = payload?.mode === "binance_connected" ? "binance_connected" : "manual";
  const nextIdempotencyKey = payload?.idempotencyKey ?? undefined;
  const nextAssets = Array.isArray(payload?.assets) ? (payload.assets as BinanceImportAsset[]) : undefined;

  const { portfolio, errorCode, isReplay } = await createUserPortfolio(
    supabase,
    user.id,
    nextName,
    nextMode,
    nextIdempotencyKey,
    nextAssets
  );

  if (errorCode === "invalid-name") {
    return NextResponse.json({ error: "Portfolio name is required." }, { status: 400 });
  }

  if (errorCode === "duplicate") {
    return NextResponse.json({ error: "Portfolio name already exists." }, { status: 409 });
  }

  if (errorCode === "idempotency-conflict") {
    return NextResponse.json(
      { error: "This setup key is already used for another request. Please retry from the create dialog." },
      { status: 409 }
    );
  }

  if (errorCode === "idempotency-expired") {
    return NextResponse.json(
      { error: "This setup session expired. Please retry to create the portfolio." },
      { status: 409 }
    );
  }

  if (errorCode === "idempotency-in-progress") {
    return NextResponse.json(
      { error: "Setup is already in progress for this request. Please wait a moment and retry." },
      { status: 409 }
    );
  }

  if (errorCode || !portfolio) {
    return NextResponse.json({ error: "Unable to create portfolio." }, { status: 500 });
  }

  return NextResponse.json({ portfolio }, { status: isReplay ? 200 : 201 });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getAuthContext(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { name?: string } | null;
  const targetName = payload?.name ?? "";

  const { success, errorCode } = await deleteUserPortfolio(supabase, user.id, targetName);

  if (errorCode === "invalid-name") {
    return NextResponse.json({ error: "Portfolio name is required." }, { status: 400 });
  }

  if (errorCode === "default-portfolio") {
    return NextResponse.json({ error: "Main Portfolio cannot be removed." }, { status: 400 });
  }

  if (errorCode === "not-found") {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  if (!success || errorCode) {
    return NextResponse.json({ error: "Unable to remove portfolio." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
