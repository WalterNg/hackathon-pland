import { NextResponse } from "next/server";
import { updateRiskAlertStatus } from "@/app/lib/repositories/risk-repo";
import type { RiskAlertStatus } from "@/app/lib/risk-types";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";

type RouteContext = {
  params: Promise<{
    alertId: string;
  }>;
};

function isAlertStatus(value: unknown): value is RiskAlertStatus {
  return value === "active" || value === "acknowledged" || value === "resolved";
}

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, user } = await getSupabaseAuthContext(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { status?: unknown } | null;
  if (!payload || !isAlertStatus(payload.status)) {
    return NextResponse.json({ error: "Invalid alert status." }, { status: 400 });
  }

  const { alertId } = await context.params;
  const alert = await updateRiskAlertStatus(supabase, user.id, alertId, payload.status);
  if (!alert) {
    return NextResponse.json({ error: "Alert not found." }, { status: 404 });
  }

  return NextResponse.json({ alert });
}
