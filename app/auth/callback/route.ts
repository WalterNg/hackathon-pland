import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextParam = requestUrl.searchParams.get("next");
  const nextPath = nextParam && nextParam.startsWith("/") ? nextParam : "/";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  
  let origin = appUrl 
    ? appUrl 
    : forwardedHost 
      ? `${forwardedProto}://${forwardedHost}` 
      : requestUrl.origin;

  // Force HTTPS on production to fix SSL Termination redirection issues causing Secure cookies to drop
  if (process.env.NODE_ENV === "production" && origin.startsWith("http://")) {
    origin = origin.replace("http://", "https://");
  }

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(new URL("/auth/login?error=missing_env", origin));
    }

    // Dùng HTML Redirect thay cho HTTP 307 Redirect
    // Điều này bắt buộc Chrome phải dừng lại, đọc và lưu Set-Cookie vào ổ cứng
    // trước khi tiếp tục chuyển hướng bằng Javascript/Meta thẻ, tránh bị triệt tiêu cookie giữa đường.
    const redirectUrl = new URL(nextPath, origin).toString();
    const response = new Response(
      `<html>
        <head>
          <meta http-equiv="refresh" content="0;url=${redirectUrl}">
          <title>Authenticating...</title>
        </head>
        <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh;">
          <p>Redirecting to your dashboard... Please wait.</p>
          <script>
            setTimeout(() => {
              window.location.href = "${redirectUrl}";
            }, 500);
          </script>
        </body>
      </html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }
    );
    
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOptions = { ...options };
            if (!cookieOptions.domain) delete cookieOptions.domain;
            
            // Xây dựng chuỗi Cookie Header chuẩn mực
            const cookieStr = `${name}=${value}; Path=${cookieOptions.path || "/"}; ${
              cookieOptions.maxAge ? `Max-Age=${cookieOptions.maxAge}; ` : ""
            }${cookieOptions.httpOnly ? "HttpOnly; " : ""}${
              cookieOptions.secure || process.env.NODE_ENV === "production" ? "Secure; " : ""
            }SameSite=${cookieOptions.sameSite || "Lax"}`;
            
            response.headers.append("Set-Cookie", cookieStr);
          });
        }
      }
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/auth/login?error=auth_callback_failed", origin));
    }

    return response;
  }

  return NextResponse.redirect(new URL(nextPath, origin));
}
