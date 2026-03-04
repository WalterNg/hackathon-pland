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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  
  const origin = appUrl 
    ? appUrl 
    : forwardedHost 
      ? `${forwardedProto}://${forwardedHost}` 
      : request.nextUrl.origin;

  if (!hasSupabaseEnv()) {
    if (isProtectedRoute) {
      const loginUrl = new URL("/auth/login", origin);
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
            if (!cookieOptions.domain) delete cookieOptions.domain;
            
            response.cookies.set({
              name,
              value,
              ...cookieOptions,
              secure: process.env.NODE_ENV === "production" || request.nextUrl.protocol === "https:",
            });
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
    const loginUrl = new URL("/auth/login", origin);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/auth/login" || pathname === "/auth/register")) {
    const nextPath = request.nextUrl.searchParams.get("next");
    const redirectUrl = new URL(nextPath && nextPath.startsWith("/") ? nextPath : "/", origin);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthRoute || isProtectedRoute) {
    return response;
  }

  return response;
}
