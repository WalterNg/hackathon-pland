/**
 * Server-side helper for proxying authenticated requests to the FastAPI backend.
 * Used by Next.js API routes so the browser never calls the backend directly.
 */

function backendUrl(): string {
  return process.env.BACKEND_API_URL?.trim() || "http://127.0.0.1:8000";
}

type ProxyOptions = {
  method?: string;
  body?: string;
  searchParams?: URLSearchParams;
};

export async function proxyBackend(
  request: Request,
  backendPath: string,
  options: ProxyOptions = {}
): Promise<Response> {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(`${backendUrl()}${backendPath}`);
  if (options.searchParams) {
    options.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  }

  const upstream = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: options.body,
    cache: "no-store",
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
