import { NextResponse } from "next/server";
import { updateRiskAlertStatus } from "@/app/lib/repositories/risk-repo";
import type { RiskAlertStatus } from "@/app/lib/risk-types";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

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
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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