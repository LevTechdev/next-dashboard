import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { getTokenFromCookie, getTokenFromRequest, hashToken } from "@/lib/auth";
import { listActiveSessions, revokeOtherSessions } from "@/lib/sessions";
import { logSecurityEvent } from "@/lib/security-events";
import { RECOGNITION_WINDOW_DAYS } from "@/lib/device-recognition";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET: list the current user's active sessions, flagging the current one. */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const token = getTokenFromRequest(req) || getTokenFromCookie(req);
  const currentHash = token ? hashToken(token) : null;

  const sessions = await listActiveSessions(session.user.id);

  // Recognized/new classification per session, using the same device/IP
  // recognition as the sign-in alert: a session is "recognized" when BOTH
  // its device profile and its ip appeared on an EARLIER session of this
  // user within the recognition window; otherwise it's flagged new.
  const since = new Date(Date.now() - RECOGNITION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const history = await prisma.session.findMany({
    where: { userId: session.user.id, createdAt: { gte: since } },
    select: { ip: true, device: true, browser: true, createdAt: true },
  });
  const historyByIp = new Map<string, number[]>();
  const historyByDevice = new Map<string, number[]>();
  for (const h of history) {
    if (h.ip) {
      historyByIp.get(h.ip)?.push(h.createdAt.getTime()) ??
        historyByIp.set(h.ip, [h.createdAt.getTime()]);
    }
    const deviceKey = `${h.device ?? ""}|${h.browser ?? ""}`;
    if (deviceKey !== "|") {
      historyByDevice.get(deviceKey)?.push(h.createdAt.getTime()) ??
        historyByDevice.set(deviceKey, [h.createdAt.getTime()]);
    }
  }
  const seenBefore = (times: number[] | undefined, at: number) => (times ?? []).some((t) => t < at);

  return NextResponse.json(
    sessions.map((s) => {
      const at = s.createdAt.getTime();
      const deviceKey = `${s.device ?? ""}|${s.browser ?? ""}`;
      const recognized =
        s.ip != null &&
        deviceKey !== "|" &&
        seenBefore(historyByIp.get(s.ip), at) &&
        seenBefore(historyByDevice.get(deviceKey), at);

      return {
        id: s.id,
        ip: s.ip,
        browser: s.browser,
        device: s.device,
        location: s.location,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        current: currentHash != null && s.tokenHash === currentHash,
        recognized,
      };
    }),
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
