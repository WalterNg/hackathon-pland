import { NextRequest, NextResponse } from "next/server";

import { backendBaseUrl } from "@/app/lib/backend-base-url";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const response = await fetch(`${backendBaseUrl()}/api/binance/connection/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { error: "Unable to load Binance preview." }, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Binance preview." },
      { status: 502 },
    );
  }
}
