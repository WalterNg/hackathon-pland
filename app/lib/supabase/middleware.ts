import { type NextRequest, NextResponse } from "next/server";

export async function updateSupabaseSession(request: NextRequest) {
  return NextResponse.next({ request });
}
