import { proxyBackendPublic } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ cert_id: string }> };

// GET /api/nft/certificate/:cert_id
// Public ERC-721 tokenURI metadata endpoint — proxied to FastAPI.
// Passes Authorization header through for extended portfolio state (Story 4.2).
export async function GET(request: Request, context: RouteContext) {
  const { cert_id } = await context.params;
  return proxyBackendPublic(request, `/api/nft/certificate/${cert_id}`);
}
