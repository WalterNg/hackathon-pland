const missingEnvMessage =
  "Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";

const missingServiceEnvMessage =
  "Supabase service role environment variable is missing. Set SUPABASE_SERVICE_ROLE_KEY.";

function isPlaceholder(value: string) {
  return (
    value.includes("your-project-ref") ||
    value.includes("your-anon-key") ||
    value.includes("your-service-role-key")
  );
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || isPlaceholder(url) || isPlaceholder(anonKey)) {
    throw new Error(missingEnvMessage);
  }

  return { url, anonKey };
}

export function hasSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return false;
  }

  return !isPlaceholder(url) && !isPlaceholder(anonKey);
}

export function getSupabaseServiceEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey || isPlaceholder(url) || isPlaceholder(serviceRoleKey)) {
    throw new Error(missingServiceEnvMessage);
  }

  return { url, serviceRoleKey };
}

export function hasSupabaseServiceEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return false;
  }

  return !isPlaceholder(url) && !isPlaceholder(serviceRoleKey);
}
