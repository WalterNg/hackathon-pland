export type CookiePayload = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export type SupabaseUser = {
  id: string;
  email?: string | null;
};

export type SupabaseAuthLike = {
  getUser: () => Promise<{ data: { user: SupabaseUser | null } }>;
  exchangeCodeForSession: (code: string) => Promise<unknown>;
  signOut: () => Promise<unknown>;
  signInWithOAuth?: (input: {
    provider: string;
    options?: { redirectTo?: string };
  }) => Promise<unknown>;
  signInWithOtp?: (input: {
    email: string;
    options?: { emailRedirectTo?: string };
  }) => Promise<unknown>;
};

export type SupabaseQueryBuilderLike = {
  select: (columns: string) => SupabaseQueryBuilderLike;
  eq: (column: string, value: string) => SupabaseQueryBuilderLike;
  maybeSingle: () => Promise<{ data: any; error: unknown }>;
  order: (column: string, options?: { ascending?: boolean }) => Promise<{ data: any; error: unknown }>;
  insert: (values: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }>;
};

export type SupabaseClientLike = {
  auth: SupabaseAuthLike;
  from: (table: string) => SupabaseQueryBuilderLike;
};
