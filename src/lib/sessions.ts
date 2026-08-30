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

/** Revoke one session (must belong to the user). Returns true if a row changed. */
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const res = await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

/** Revoke every session for the user EXCEPT the one matching currentToken. */
export async function revokeOtherSessions(userId: string, currentToken: string): Promise<number> {
  const res = await prisma.session.updateMany({
    where: { userId, revokedAt: null, tokenHash: { not: hashToken(currentToken) } },
    data: { revokedAt: new Date() },
  });
  return res.count;
}

/** Whether the token's session has been revoked (used to enforce revocation). */
export async function isTokenRevoked(token: string): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { revokedAt: true },
  });
  return session?.revokedAt != null;
}
