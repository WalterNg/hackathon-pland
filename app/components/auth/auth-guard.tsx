"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

type AuthGuardProps = {
  children: ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isReady, setReady] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const ensureSession = async () => {
      const supabase = await createSupabaseBrowserClient();
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (isCancelled) {
        return;
      }

      if (!session?.access_token) {
        const nextQuery = searchParams.toString();
        const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname;
        router.replace(`/auth/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      setReady(true);
    };

    void ensureSession();

    return () => {
      isCancelled = true;
    };
  }, [pathname, router, searchParams]);

  if (!isReady) {
    return <div className="panel-low p-5 text-sm text-muted">Checking authentication...</div>;
  }

  return <>{children}</>;
}
