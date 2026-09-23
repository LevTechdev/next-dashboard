import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { listSecurityEvents } from "@/lib/security-events";
import { effectiveTenantId, tenantWhere } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

/**
 * GET: recent security events for the current user (Profile → Security feed),
 * scoped to the caller's workspace so one tenant never sees another's events.
 */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const tenantScope = tenantWhere(await effectiveTenantId(session!));
  // Client may request a larger window (Security Center telemetry summarises
  // RATE_LIMITED / ACCOUNT_LOCKED rows); capped hard so it can't be abused.
  const url = new URL(req.url);
  const takeParam = Number.parseInt(url.searchParams.get("take") ?? "", 10);
  const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 100) : 20;
  const events = await listSecurityEvents(session.user.id, tenantScope, take);
  return NextResponse.json(events);
}
