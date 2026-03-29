"use client";

import { createSupabaseBrowserClient } from "./client";

export async function fetchWithSupabaseAuth(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  const supabase = await createSupabaseBrowserClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "same-origin"
  });
}
