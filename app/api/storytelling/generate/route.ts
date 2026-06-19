import { proxyBackend } from "@/app/lib/backend-proxy";

export const dynamic = "force-dynamic";

// POST /api/storytelling/generate  { mode: "share" | "audit" }
// Generates AI narrative (story 6.3) or audit report (story 6.4).
export async function POST(request: Request) {
  const body = await request.text();
  return proxyBackend(request, "/api/storytelling/generate", {
    method: "POST",
    body,
  });
}
