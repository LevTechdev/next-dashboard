import "server-only";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/auth";
import { getRequestMeta } from "@/lib/request-meta";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // matches JWT 7d

/** Record a per-device session for a freshly issued access token + refresh family. */
export async function createSession(params: {
  userId: string;
  token: string;
  req: Request;
  familyId?: string;
}): Promise<string> {
  const meta = getRequestMeta(params.req);
  const session = await prisma.session.create({
    data: {
      userId: params.userId,
      tokenHash: hashToken(params.token),
      familyId: params.familyId ?? null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      browser: meta.browser,
      device: meta.device,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return session.id;
}

/**
 * On refresh rotation, point the session at the NEW access token hash and bump
 * activity so revocation-by-access-hash + the Active Sessions panel stay correct.
 */
export async function rotateSessionAccessToken(
  familyId: string,
  newAccessToken: string,
): Promise<void> {
  try {
    await prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { tokenHash: hashToken(newAccessToken), lastActiveAt: new Date() },
    });
  } catch {
    /* non-critical */
  }
}

/** Revoke all sessions belonging to a refresh-token family. */
export async function revokeSessionsByFamily(familyId: string): Promise<void> {
  try {
    await prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    /* non-critical */
  }
}

/** List a user's non-revoked, non-expired sessions (newest first). */
export async function listActiveSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: "desc" },
  });
}

/** Mark the session matching the current request's token as most-recently active. */
export async function touchSession(userId: string, token: string): Promise<void> {
  try {
    await prisma.session.updateMany({
      where: { userId, tokenHash: hashToken(token), revokedAt: null },
      data: { lastActiveAt: new Date() },
    });
  } catch {
    /* non-critical */
  }
}

/**
 * Kill a refresh-token family entirely: revoke every live token in it and
 * clear any durable stay-login grant. A revoked SESSION whose family survives
 * is a re-entry path — the device's still-valid refresh cookie mints a fresh
 * (Session-less) access token and walks right back past the revocation check.
 */
async function revokeFamiliesByIds(familyIds: Array<string | null>): Promise<number> {
  const ids = [...new Set(familyIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return 0;
  const [tokens] = await Promise.all([
    prisma.refreshToken.updateMany({
      where: { familyId: { in: ids }, revokedAt: null },
      data: { revokedAt: new Date(), stayLoginUntil: null },
    }),
  ]);
  return tokens.count;
}

/** Revoke one session (must belong to the user) and its refresh-token family. */
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const target = await prisma.session.findFirst({
    where: { id: sessionId, userId, revokedAt: null },
    select: { familyId: true },
  });
  if (!target) return false;
  const res = await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  // Without this, the revoked device's still-valid refresh cookie mints a
  // fresh access token and walks back in; its stay-login grant dies too.
  await revokeFamiliesByIds([target.familyId]);
  return res.count > 0;
}

/** Revoke every session for the user EXCEPT the one matching currentToken. */
export async function revokeOtherSessions(userId: string, currentToken: string): Promise<number> {
  const others = await prisma.session.findMany({
    where: { userId, revokedAt: null, tokenHash: { not: hashToken(currentToken) } },
    select: { familyId: true },
  });
  const res = await prisma.session.updateMany({
    where: { userId, revokedAt: null, tokenHash: { not: hashToken(currentToken) } },
    data: { revokedAt: new Date() },
  });
  // The other devices' refresh cookies must not outlive their sessions.
  await revokeFamiliesByIds(others.map((s) => s.familyId));
  return res.count;
}

/**
 * Revoke EVERY session for the user — including the one making the request
 * ("sign out everywhere"). Takes effect on the caller's NEXT request, since
 * the just-used token is only re-checked after the response is sent.
 */
export async function revokeAllSessions(userId: string): Promise<number> {
  const all = await prisma.session.findMany({
    where: { userId, revokedAt: null },
    select: { familyId: true },
  });
  const res = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await revokeFamiliesByIds(all.map((s) => s.familyId));
  return res.count;
}

/**
 * Whether the token's session has been revoked (used to enforce revocation).
 *
 * Fail-CLOSED by absence: every sign-in path (password, passkey, SAML) creates
 * a Session row and every refresh rotation re-points it, so an access token
 * whose hash matches NO row is a token minted after its session was revoked
 * (rotateSessionAccessToken matched 0 rows) — exactly the token "sign out
 * everywhere" exists to kill. Returning false for it re-opened the door: the
 * sweep revoked the rows, the still-valid refresh cookie minted one fresh
 * Session-less access token, and that token walked back in as "legacy".
 */
export async function isTokenRevoked(token: string): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { revokedAt: true },
  });
  return session === null || session.revokedAt != null;
}
