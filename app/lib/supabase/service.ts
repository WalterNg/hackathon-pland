import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceEnv } from "./env";

let serviceClient: SupabaseClient | null = null;

export function createSupabaseServiceClient() {
  if (serviceClient) {
    return serviceClient;
  }

  const { url, serviceRoleKey } = getSupabaseServiceEnv();

  serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return serviceClient;
}
