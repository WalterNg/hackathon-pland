"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

const DEFAULT_NEXT_PATH = "/";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing sign in...");

  useEffect(() => {
    let isCancelled = false;

    const completeSignIn = async () => {
      const nextParam = searchParams.get("next");
      const nextPath = nextParam && nextParam.startsWith("/") ? nextParam : DEFAULT_NEXT_PATH;

      try {
        const supabase = await createSupabaseBrowserClient();

        for (let attempt = 0; attempt < 10; attempt += 1) {
          const {
            data: { session }
          } = await supabase.auth.getSession();

          if (session?.access_token) {
            if (!isCancelled) {
              window.location.assign(nextPath);
            }
            return;
          }

          await new Promise((resolve) => window.setTimeout(resolve, 300));
        }

        throw new Error("Unable to establish browser session.");
      } catch {
        if (!isCancelled) {
          setMessage("Sign in failed. Redirecting back to login...");
          router.replace(`/auth/login?error=${encodeURIComponent("auth_callback_failed")}`);
        }
      }
    };

    void completeSignIn();

    return () => {
      isCancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
      <div className="panel-glass w-full max-w-md p-6 text-center sm:p-8">
        <div className="eyebrow mb-3">Access Portal</div>
        <h1 className="typo-display text-strong">Signing you in</h1>
        <p className="mt-3 text-sm text-muted">{message}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
          <div className="panel-glass w-full max-w-md p-6 text-center sm:p-8">
            <div className="eyebrow mb-3">Access Portal</div>
            <h1 className="typo-display text-strong">Signing you in</h1>
            <p className="mt-3 text-sm text-muted">Completing sign in...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
