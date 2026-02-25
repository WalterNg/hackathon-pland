import { createSupabaseServerClient } from "../supabase/server";

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
}

export async function getSessionUserOrThrow() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Authentication required");
  }

  return user;
}
