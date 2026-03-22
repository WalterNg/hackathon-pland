import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

type AuthContext = {
  supabase: SupabaseClient;
  user: User | null;
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice("bearer ".length).trim();
  return token || null;
}

function createSupabaseBearerClient(accessToken: string) {
  const { url, anonKey } = getSupabaseEnv();
  const authorizationHeaders = accessToken
    ? {
        Authorization: `Bearer ${accessToken}`
      }
    : undefined;

  return createClient(url, anonKey, {
    global: authorizationHeaders ? { headers: authorizationHeaders } : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export async function getSupabaseAuthContext(request: Request): Promise<AuthContext> {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return { supabase: createSupabaseBearerClient(""), user: null };
  }

  const supabase = createSupabaseBearerClient(accessToken);
  const {
    data: { user }
  } = await supabase.auth.getUser(accessToken);

  return { supabase, user };
}
