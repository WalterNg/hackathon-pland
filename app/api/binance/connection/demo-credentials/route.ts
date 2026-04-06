import { NextResponse } from "next/server";

import { backendBaseUrl } from "@/app/lib/backend-base-url";

export async function GET() {
  try {
    const response = await fetch(`${backendBaseUrl()}/api/binance/connection/demo-credentials`, {
      method: "GET",
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { error: "Unable to load demo credentials." }, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load demo credentials." },
      { status: 502 },
    );
  }
}
