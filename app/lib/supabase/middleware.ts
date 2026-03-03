import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseEnv } from "./env";

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasSupabaseEnv()) {
    return response;
  }

  if (request.nextUrl.pathname.startsWith('/_next') || request.nextUrl.pathname.includes('.') || request.nextUrl.pathname.startsWith('/api')) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOptions = { ...options };
            if (!cookieOptions.domain) delete cookieOptions.domain;
            response.cookies.set(name, value, cookieOptions);
          });
        },
      },
    }
  );

  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user ? { id: data.user.id } : null;
  } catch {
    user = null;
  }

  const pathname = request.nextUrl.pathname;
  
  if (pathname === "/auth/callback") {
    return response;
  }

  const isProtectedRoute = pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname === "/portfolio" || pathname.startsWith("/portfolio/") || pathname === "/journal" || pathname.startsWith("/journal/");
  const isAuthPage = pathname === "/auth/login" || pathname === "/auth/register";

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const homeUrl = request.nextUrl.clone();
    const nextPath = request.nextUrl.searchParams.get("next");
    if (nextPath && nextPath.startsWith("/")) {
      homeUrl.pathname = nextPath;
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}
