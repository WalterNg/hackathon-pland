import { NextResponse } from "next/server";
import {
  deletePortfolioTransaction,
  updatePortfolioTransaction,
} from "@/app/lib/repositories/portfolio-transactions-repo";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";

type RouteContext = { params: Promise<{ id: string }> };

function triggerPortfolioRiskRefresh(request: Request, portfolioName: string | null): void {
  if (!portfolioName) return;
  const snapshotUrl = new URL(
    `/api/binance/portfolio?name=${encodeURIComponent(portfolioName)}`,
    request.url
  );
  const authorization = request.headers.get("authorization") ?? "";
  void fetch(snapshotUrl.toString(), {
    method: "GET",
    headers: authorization ? { authorization } : undefined,
    cache: "no-store",
  }).catch(() => undefined);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { supabase, user } = await getSupabaseAuthContext(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Transaction ID is required." }, { status: 400 });
  }

  const ok = await deletePortfolioTransaction(supabase, user.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Unable to delete transaction." }, { status: 500 });
  }

  const portfolioName = new URL(request.url).searchParams.get("portfolioName");
  triggerPortfolioRiskRefresh(request, portfolioName);

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { supabase, user } = await getSupabaseAuthContext(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Transaction ID is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    quantity?: number;
    priceUsd?: number;
    feeUsd?: number;
    note?: string | null;
    executedAt?: string;
  } | null;

  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const ok = await updatePortfolioTransaction(supabase, user.id, id, {
    quantity: body.quantity,
    priceUsd: body.priceUsd,
    feeUsd: body.feeUsd,
    note: body.note,
    executedAt: body.executedAt,
  });

  if (!ok) {
    return NextResponse.json({ error: "Unable to update transaction." }, { status: 500 });
  }

  const portfolioName = new URL(request.url).searchParams.get("portfolioName");
  triggerPortfolioRiskRefresh(request, portfolioName);

  return NextResponse.json({ ok: true }, { status: 200 });
}
