"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

const DEFAULT_NEXT_PATH = "/";

function LoginContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.trim() || DEFAULT_NEXT_PATH;
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setLoadingGoogle(true);
    setAuthError(null);

    try {
      const supabase = await createSupabaseBrowserClient();

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
        }
      });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to start Google sign-in.");
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-card-light p-6 shadow-soft sm:p-8">
        <h1 className="mb-6 text-center text-2xl font-bold text-strong">Sign in</h1>

        {authError && <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 text-xs text-danger">{authError}</div>}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loadingGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:bg-primary-hover disabled:opacity-70"
        >
          {loadingGoogle ? "Redirecting..." : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-card-light p-6 shadow-soft sm:p-8">
            <p className="text-sm text-muted">Loading sign in...</p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
