import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { getTokenFromCookie, getTokenFromRequest, hashToken } from "@/lib/auth";
import { listActiveSessions, revokeOtherSessions } from "@/lib/sessions";
import { logSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

/** GET: list the current user's active sessions, flagging the current one. */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const token = getTokenFromRequest(req) || getTokenFromCookie(req);
  const currentHash = token ? hashToken(token) : null;

  const sessions = await listActiveSessions(session.user.id);
  return NextResponse.json(
    sessions.map((s) => ({
      id: s.id,
      ip: s.ip,
      browser: s.browser,
      device: s.device,
      location: s.location,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      current: currentHash != null && s.tokenHash === currentHash,
    })),
  );
}

/** DELETE: revoke all sessions except the current one. */
export async function DELETE(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const token = getTokenFromRequest(req) || getTokenFromCookie(req);
  if (!token) {
    return NextResponse.json({ error: "No active session" }, { status: 400 });
  }

  const count = await revokeOtherSessions(session.user.id, token);
  await logSecurityEvent({
    userId: session.user.id,
    type: "SESSIONS_REVOKED_ALL",
    req,
    metadata: { count },
    tenantId: session.user.tenantId,
  });
  return NextResponse.json({ success: true, revoked: count });
}
