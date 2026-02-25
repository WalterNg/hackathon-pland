"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const missingEnvMessage =
  "Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";

type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
};

let browserClient: SupabaseClient | null = null;
let browserClientPromise: Promise<SupabaseClient> | null = null;

function isPlaceholder(value: string) {
  return value.includes("your-project-ref") || value.includes("your-anon-key");
}

function readPublicEnvFromBundle(): PublicSupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  if (isPlaceholder(url) || isPlaceholder(anonKey)) {
    return null;
  }

  return { url, anonKey };
}

async function readPublicEnvFromServer(): Promise<PublicSupabaseConfig> {
  const response = await fetch("/api/auth/config", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(missingEnvMessage);
  }

  const payload = (await response.json()) as Partial<PublicSupabaseConfig>;
  if (!payload.url || !payload.anonKey) {
    throw new Error(missingEnvMessage);
  }

  return { url: payload.url, anonKey: payload.anonKey };
}

async function resolvePublicEnv(): Promise<PublicSupabaseConfig> {
  const fromBundle = readPublicEnvFromBundle();
  if (fromBundle) {
    return fromBundle;
  }

  return readPublicEnvFromServer();
}

export async function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  if (browserClientPromise) {
    return browserClientPromise;
  }

  browserClientPromise = (async () => {
    const { url, anonKey } = await resolvePublicEnv();
    browserClient = createBrowserClient(url, anonKey);
    return browserClient;
  })();

  return browserClientPromise;
}
