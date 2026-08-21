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
  const events = await listSecurityEvents(session.user.id, tenantScope, 20);
  return NextResponse.json(events);
}
