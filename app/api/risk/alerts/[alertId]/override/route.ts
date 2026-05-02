import { NextResponse } from "next/server";
import { revokeRiskAlertOverride } from "@/app/lib/repositories/risk-repo";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";

type RouteContext = {
  params: Promise<{ alertId: string }>;
};

export const dynamic = "force-dynamic";

// E1-S4: DELETE /api/risk/alerts/{alertId}/override — manually revoke an override
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
  const alert = await revokeRiskAlertOverride(supabase, user.id, alertId);
  if (!alert) {
    return NextResponse.json({ error: "Overridden alert not found." }, { status: 404 });
  }

  return NextResponse.json({ alert });
}
