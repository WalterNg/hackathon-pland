import { proxyBackend } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.text();
  return proxyBackend(request, `/api/risk-rules/alerts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
}
