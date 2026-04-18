import { proxyBackend } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/portfolio_snapshot_certificates/:id
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyBackend(request, `/api/portfolio_snapshot_certificates/${id}`);
}
