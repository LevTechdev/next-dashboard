import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { getTokenFromCookie, getTokenFromRequest, hashToken } from "@/lib/auth";
import { listActiveSessions, revokeAllSessions, revokeOtherSessions } from "@/lib/sessions";
import { revokeAllTrustedDevices } from "@/lib/trusted-devices";
import { revokeAllRefreshTokens } from "@/lib/refresh-tokens";
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

  // Live 30-day trust cookies, keyed by device|browser (the same profile
  // strings Session.device/browser carry).
  const trustedDevices = await prisma.trustedDevice.findMany({
    where: {
      userId: session.user.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { device: true, browser: true },
  });
  const trustedKeys = new Set(trustedDevices.map((d) => `${d.device}|${d.browser}`));

  // Live stay-login grants per refresh-token family (a session inherits its
  // family's grant — the durable 7-day window behind "Stay signed in").
  const familyIds = [...new Set(sessions.map((s) => s.familyId).filter(Boolean))] as string[];
  const grants = familyIds.length
    ? await prisma.refreshToken.findMany({
        where: { familyId: { in: familyIds }, revokedAt: null, stayLoginUntil: { gt: new Date() } },
        select: { familyId: true, stayLoginUntil: true },
      })
    : [];
  const grantByFamily = new Map(
    grants.map((g) => [g.familyId, g.stayLoginUntil?.toISOString() ?? null]),
  );

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
        // Device-policy context: whether this device holds a 30-day trust
        // cookie (2FA skip), and whether its refresh family carries a live
        // stay-login grant (the long session window). Both feed the UI's
        // trust badges and the per-device policy the user can revoke.
        trusted: trustedKeys.has(`${s.device ?? ""}|${s.browser ?? ""}`),
        stayLoginUntil: grantByFamily.get(s.familyId ?? "") ?? null,
      };
    }),
  );
}

/**
 * DELETE: revoke sessions. Default ("revoke all others") keeps the current
 * session; `{ everywhere: true }` signs out EVERY device including this one
 * and revokes every trusted device, so no 2FA skip survives the sweep.
 */
export async function DELETE(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));

  if (body.everywhere === true) {
    // Refresh-token families die with the sessions — otherwise a still-valid
    // refresh cookie mints a fresh (Session-less) access token and walks
    // right back in past the revocation check.
    const [sessions, devices, refreshTokens] = await Promise.all([
      revokeAllSessions(session.user.id),
      revokeAllTrustedDevices(session.user.id),
      revokeAllRefreshTokens(session.user.id),
    ]);
    await logSecurityEvent({
      userId: session.user.id,
      type: "SESSIONS_REVOKED_ALL",
      req,
      metadata: { everywhere: true, sessions, trustedDevices: devices, refreshTokens },
      tenantId: session.user.tenantId,
    });
    // The response carries no Set-Cookie beyond the normal clear: the client
    // redirects to /login, and the revoked token is rejected on its next use.
    return NextResponse.json({ success: true, revoked: sessions, trustedDevices: devices });
  }

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
