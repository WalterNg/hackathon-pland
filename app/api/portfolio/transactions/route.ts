import { NextResponse } from "next/server";
import {
  createPortfolioTransaction,
  listRecentTransactions
} from "@/app/lib/repositories/portfolio-transactions-repo";
import {
  MAIN_PORTFOLIO_NAME,
  resolveUserPortfolioByName
} from "@/app/lib/repositories/portfolios-repo";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

type TransactionAction = "buy" | "sell" | "transfer";
type TransferDirection = "in" | "out";

type CreateTransactionPayload = {
  portfolioName?: string;
  symbol?: string;
  action?: TransactionAction;
  transferDirection?: TransferDirection;
  quantity?: number;
  priceUsd?: number;
  feeUsd?: number;
  note?: string;
  executedAt?: string;
};

function toTransactionSide(action: TransactionAction, transferDirection?: TransferDirection) {
  if (action === "buy") {
    return "buy" as const;
  }

  if (action === "sell") {
    return "sell" as const;
  }

  if (transferDirection === "in") {
    return "deposit" as const;
  }

  return "withdrawal" as const;
}

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function triggerPortfolioRiskRefresh(request: Request, portfolioName: string): void {
  const snapshotUrl = new URL(`/api/binance/portfolio?name=${encodeURIComponent(portfolioName)}`, request.url);
  const cookie = request.headers.get("cookie") ?? "";

  void fetch(snapshotUrl.toString(), {
    method: "GET",
    headers: cookie ? { cookie } : undefined,
    cache: "no-store"
  }).catch(() => undefined);
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const portfolioName = searchParams.get("portfolioName")?.trim() || MAIN_PORTFOLIO_NAME;
  const limitParam = Number(searchParams.get("limit") ?? 6);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 20) : 6;

  const items = await listRecentTransactions(supabase, user.id, portfolioName, limit);
  if (!items) {
    return NextResponse.json({ error: "Unable to load transactions." }, { status: 500 });
  }

  return NextResponse.json({ transactions: items });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as CreateTransactionPayload | null;
  const portfolioName = payload?.portfolioName?.trim() || MAIN_PORTFOLIO_NAME;
  const symbol = payload?.symbol?.trim().toUpperCase() || "";
  const action = payload?.action;
  const transferDirection = payload?.transferDirection;
  const quantity = Number(payload?.quantity ?? 0);
  const priceUsd = Number(payload?.priceUsd ?? 0);
  const feeUsd = Number(payload?.feeUsd ?? 0);
  const note = payload?.note?.trim() || undefined;
  const executedAt = payload?.executedAt ?? new Date().toISOString();

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
  }

  if (action !== "buy" && action !== "sell" && action !== "transfer") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  if (!isPositiveNumber(quantity)) {
    return NextResponse.json({ error: "Quantity must be greater than 0." }, { status: 400 });
  }

  if (action !== "transfer" && (!Number.isFinite(priceUsd) || priceUsd <= 0)) {
    return NextResponse.json({ error: "Price per coin must be greater than 0." }, { status: 400 });
  }

  if (!Number.isFinite(feeUsd) || feeUsd < 0) {
    return NextResponse.json({ error: "Fee must be >= 0." }, { status: 400 });
  }

  if (action === "transfer" && transferDirection && transferDirection !== "in" && transferDirection !== "out") {
    return NextResponse.json({ error: "Invalid transfer direction." }, { status: 400 });
  }

  if (portfolioName === MAIN_PORTFOLIO_NAME) {
    return NextResponse.json(
      { error: "Main Portfolio is aggregate only. Add transactions in a child portfolio." },
      { status: 400 }
    );
  }

  const portfolio = await resolveUserPortfolioByName(supabase, user.id, portfolioName);
  if (!portfolio?.id) {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  if (portfolio.mode === "binance_connected") {
    return NextResponse.json(
      { error: "Connected portfolios are read-only. Manual transactions are disabled." },
      { status: 403 }
    );
  }

  const created = await createPortfolioTransaction(supabase, {
    userId: user.id,
    portfolioId: portfolio.id,
    symbol,
    side: toTransactionSide(action, transferDirection),
    quantity,
    priceUsd: action === "transfer" ? 0 : priceUsd,
    feeUsd,
    note,
    executedAt
  });

  if (!created) {
    return NextResponse.json({ error: "Unable to create transaction." }, { status: 500 });
  }

  triggerPortfolioRiskRefresh(request, portfolioName);

  return NextResponse.json({ transaction: created }, { status: 201 });
}
