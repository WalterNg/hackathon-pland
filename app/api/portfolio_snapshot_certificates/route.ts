import { proxyBackend } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

// GET /api/portfolio_snapshot_certificates?portfolio_id=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return proxyBackend(request, "/api/portfolio_snapshot_certificates", { searchParams });
}

// POST /api/portfolio_snapshot_certificates
export async function POST(request: Request) {
  const body = await request.text();
  return proxyBackend(request, "/api/portfolio_snapshot_certificates", {
    method: "POST",
    body,
  });
}
