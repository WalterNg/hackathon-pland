import { NextResponse } from "next/server";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const BACKEND_TIMEOUT_MS = 30000;

function backendBaseUrl(): string {
  return process.env.AI_BACKEND_URL?.trim() || process.env.BACKEND_API_URL?.trim() || DEFAULT_BACKEND_URL;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const baseUrl = backendBaseUrl();
  const endpoint = `${baseUrl}/api/binance/connection/preview`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify(body ?? {}),
    });

    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { error: "Unable to reach Binance connector." }, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error.";
    const isAbort = error instanceof Error && error.name === "AbortError";
    const guidance = isAbort
      ? `Timed out after ${BACKEND_TIMEOUT_MS / 1000}s while contacting backend.`
      : "Unable to connect to backend service.";

    return NextResponse.json(
      {
        error: `${guidance} Endpoint: ${endpoint}. Raw error: ${message}.`,
        hint: "Check that FastAPI is running and AI_BACKEND_URL/BACKEND_API_URL points to the correct host."
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
