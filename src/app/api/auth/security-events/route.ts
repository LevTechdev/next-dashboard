import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { listSecurityEvents } from "@/lib/security-events";

export const dynamic = "force-dynamic";

/** GET: recent security events for the current user (Profile → Security feed). */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const events = await listSecurityEvents(session.user.id, 20);
  return NextResponse.json(events);
}
