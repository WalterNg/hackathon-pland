import { proxyBackend } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

// GET /api/storytelling/nfts?portfolio_id=<id>
// Returns the authenticated user's minted NFTs with on-chain verification (stories 6.1 + 6.2).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();
  const portfolioId = searchParams.get("portfolio_id");
  if (portfolioId) params.set("portfolio_id", portfolioId);
  return proxyBackend(request, "/api/storytelling/nfts", { searchParams: params });
}
