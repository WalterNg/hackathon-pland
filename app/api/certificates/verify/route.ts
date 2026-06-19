import { proxyBackendPublic } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

// GET /api/certificates/verify?hash={snapshot_hash}
// Public endpoint — no auth required. Passes Authorization header if present
// so the owner gets their full portfolio state (story 5.4).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash") ?? "";
  return proxyBackendPublic(request, "/api/certificates/verify", {
    searchParams: new URLSearchParams({ hash }),
  });
}
