"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

const DEFAULT_NEXT_PATH = "/";

function RegisterContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.trim() || DEFAULT_NEXT_PATH;
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const signUpWithGoogle = async () => {
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
      setAuthError(error instanceof Error ? error.message : "Unable to start Google sign-up.");
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
      <div className="panel-glass w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="eyebrow mb-3">Access Portal</div>
          <h1 className="typo-display text-center text-strong">Sign up</h1>
        </div>

        {authError && <div className="panel-low mb-4 p-3 text-xs text-danger">{authError}</div>}

        <button
          type="button"
          onClick={signUpWithGoogle}
          disabled={loadingGoogle}
          className="ui-button-primary flex w-full items-center justify-center gap-2 disabled:opacity-70"
        >
          {loadingGoogle ? "Redirecting..." : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
          <div className="panel-glass w-full max-w-md p-6 sm:p-8">
            <p className="text-sm text-muted">Loading sign up...</p>
          </div>
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
