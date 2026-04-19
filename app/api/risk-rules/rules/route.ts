import { proxyBackend } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return proxyBackend(request, "/api/risk-rules/rules", { searchParams });
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const body = await request.text();
  return proxyBackend(request, "/api/risk-rules/rules", {
    method: "PUT",
    searchParams,
    body,
  });
}
