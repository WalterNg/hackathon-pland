import { proxyBackend } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  return proxyBackend(request, "/api/risk-rules/evaluate", {
    method: "POST",
    body,
  });
}
