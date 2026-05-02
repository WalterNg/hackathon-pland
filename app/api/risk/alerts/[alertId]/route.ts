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
  return (
    value === "active" ||
    value === "acknowledged" ||
    value === "snoozed" ||
    value === "overridden" ||
    value === "resolved"
  );
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

  const payload = (await request.json().catch(() => null)) as {
    status?: unknown;
    overrideReason?: string;
    overrideExpiresInHours?: number | null;
    snoozedUntilMinutes?: number;
  } | null;

  if (!payload || !isAlertStatus(payload.status)) {
    return NextResponse.json({ error: "Invalid alert status." }, { status: 400 });
  }

  const { alertId } = await context.params;

  const overridePayload =
    payload.status === "overridden"
      ? { reason: payload.overrideReason, expiresInHours: payload.overrideExpiresInHours ?? null }
      : payload.status === "snoozed"
      ? { reason: undefined, expiresInHours: null, snoozedUntilMinutes: payload.snoozedUntilMinutes ?? 30 }
      : undefined;

  const alert = await updateRiskAlertStatus(supabase, user.id, alertId, payload.status, overridePayload);
  if (!alert) {
    return NextResponse.json({ error: "Alert not found." }, { status: 404 });
  }

  return NextResponse.json({ alert });
}
