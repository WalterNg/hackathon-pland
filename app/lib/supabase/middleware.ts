import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseEnv } from "./env";

export async function updateSupabaseSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute =
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/portfolio" ||
    pathname.startsWith("/portfolio/") ||
    pathname === "/journal" ||
    pathname.startsWith("/journal/");
  const isAuthRoute = pathname === "/auth/login" || pathname === "/auth/register" || pathname === "/auth/callback";

  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next({ request });
  }

  if (!hasSupabaseEnv()) {
    if (isProtectedRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

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
            if (!cookieOptions.domain) {
              delete cookieOptions.domain;
            }
            response.cookies.set(name, value, cookieOptions);
          });
        }
      }
    }
  );

  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user ? { id: data.user.id } : null;
  } catch {
    user = null;
  }

  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/auth/login" || pathname === "/auth/register")) {
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

  if (isAuthRoute || isProtectedRoute) {
    return response;
  }

  return response;
}
