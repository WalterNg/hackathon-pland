import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextParam = requestUrl.searchParams.get("next");
  const nextPath = nextParam && nextParam.startsWith("/") ? nextParam : "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/auth/login?error=auth_callback_failed", requestUrl.origin));
    }

    // Brief delay so session cookie propagates before redirect
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
