import { proxyBackend } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

// GET /api/storytelling/nfts
// Returns the authenticated user's minted NFTs with on-chain verification (stories 6.1 + 6.2).
export async function GET(request: Request) {
  return proxyBackend(request, "/api/storytelling/nfts");
}
