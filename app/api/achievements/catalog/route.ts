import { proxyBackend } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

// GET /api/achievements/catalog
export async function GET(request: Request) {
  return proxyBackend(request, "/api/achievements/catalog");
}
