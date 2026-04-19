import { proxyBackend } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return proxyBackend(request, "/api/risk-rules/score", { searchParams });
}
