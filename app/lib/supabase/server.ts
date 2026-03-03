import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOptions = { ...options };
            if (!cookieOptions.domain) {
              delete cookieOptions.domain;
            }
            cookieStore.set(name, value, cookieOptions);
          });
        } catch {
          // ignored: called from contexts where cookies are read-only
        }
      }
    }
  });
}
