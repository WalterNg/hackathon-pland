import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/app/lib/supabase/env";

export async function GET() {
  try {
    const { url, anonKey } = getSupabaseEnv();
    return NextResponse.json({ url, anonKey });
  } catch {
    return NextResponse.json(
      {
        error:
          "Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      },
      { status: 500 }
    );
  }
}
