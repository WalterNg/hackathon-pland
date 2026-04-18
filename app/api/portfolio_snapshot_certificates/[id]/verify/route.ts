import { proxyBackend } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/portfolio_snapshot_certificates/:id/verify
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyBackend(request, `/api/portfolio_snapshot_certificates/${id}/verify`, {
    method: "POST",
    body,
  });
}
