import { NextResponse } from "next/server";

type ExchangeInfoSymbol = {
  symbol: string;
  status: string;
  isSpotTradingAllowed: boolean;
  baseAsset: string;
  quoteAsset: string;
};

const BINANCE_BASE_URL = "https://api.binance.com";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toUpperCase() || "";

  try {
    const response = await fetch(`${BINANCE_BASE_URL}/api/v3/exchangeInfo`, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ symbols: [] }, { status: 200 });
    }

    const payload = (await response.json()) as { symbols?: ExchangeInfoSymbol[] };
    const rows = payload.symbols ?? [];

    const symbols = rows
      .filter((item) => item.status === "TRADING" && item.isSpotTradingAllowed)
      .filter((item) => item.quoteAsset === "USDT")
      .map((item) => ({
        symbol: item.symbol,
        baseAsset: item.baseAsset,
        quoteAsset: item.quoteAsset
      }))
      .filter((item) => {
        if (!query) {
          return true;
        }

        return item.symbol.includes(query) || item.baseAsset.includes(query);
      })
      .slice(0, 300);

    return NextResponse.json({ symbols });
  } catch {
    return NextResponse.json({ symbols: [] }, { status: 200 });
  }
}