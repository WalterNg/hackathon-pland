import { NextResponse } from "next/server";
import { cancelRiskAlertSnooze } from "@/app/lib/repositories/risk-repo";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";

type RouteContext = {
  params: Promise<{ alertId: string }>;
};

export const dynamic = "force-dynamic";

// E2-S1: DELETE /api/risk/alerts/{alertId}/snooze — cancel snooze early
export async function DELETE(request: Request, context: RouteContext) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, user } = await getSupabaseAuthContext(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { alertId } = await context.params;
  const alert = await cancelRiskAlertSnooze(supabase, user.id, alertId);
  if (!alert) {
    return NextResponse.json({ error: "Snoozed alert not found." }, { status: 404 });
  }

  return NextResponse.json({ alert });
}
