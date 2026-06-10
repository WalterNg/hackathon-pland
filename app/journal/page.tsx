"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function JournalRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const name = searchParams.get("name") || "Main Portfolio";
    const params = new URLSearchParams({ name, tab: "journal" });
    router.replace(`/portfolio?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <span className="text-sm text-muted">Redirecting…</span>
    </div>
  );
}

export default function JournalPage() {
  return (
    <Suspense>
      <JournalRedirect />
    </Suspense>
  );
}
