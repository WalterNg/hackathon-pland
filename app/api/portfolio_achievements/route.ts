import { proxyBackend } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

// GET /api/portfolio_achievements?portfolio_id=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return proxyBackend(request, "/api/portfolio_achievements", { searchParams });
}
