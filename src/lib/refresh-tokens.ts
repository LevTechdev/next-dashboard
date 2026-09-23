import "server-only";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { hashToken, generateRefreshToken, REFRESH_MAX_AGE } from "@/lib/auth";
import { revokeSessionsByFamily } from "@/lib/sessions";

function refreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_MAX_AGE * 1000);
}

/** A brand-new refresh-token family id (one per login/device). */
export function newFamilyId(): string {
  return randomUUID();
}

/** Persist a refresh token (initial issue at login, or a rotated one). Returns the raw token. */
export async function createRefreshToken(
  userId: string,
  familyId: string,
  sessionId?: string | null,
): Promise<string> {
  const token = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      sessionId: sessionId ?? null,
      tokenHash: hashToken(token),
      expiresAt: refreshExpiry(),
    },
  });
  return token;
}

export type RotateResult =
  | {
      status: "ok";
      userId: string;
      familyId: string;
      sessionId: string | null;
      token: string;
      /** True when this mint came from the benign-replay grace window. */
      graced?: true;
    }
  | { status: "reuse"; familyId: string; userId: string }
  | { status: "invalid" };

/**
 * Benign-replay leeway. A rotation is a single-use exchange, but a browser can
 * legitimately present the SAME token twice within a moment: two tabs
 * restoring a session, or a retry after a response was lost in flight. Without
 * leeway both would be judged as theft and the family revoked — the user is
 * signed out of every tab by their own second tab.
 *
 * Inside this window a consumed token mints a fresh sibling instead of
 * revoking. A revoked token, a revoked family (logout) or a replay older than
 * the window still trips theft handling.
 */
export const REFRESH_GRACE_MS = 30_000;

/**
 * Rotate a refresh token: consume the presented one and mint a replacement in
 * the same family. Presenting an already-consumed or revoked token is treated
 * as theft/replay and revokes the ENTIRE family (all tokens + sessions) —
 * except for the benign-replay grace window documented above.
 */
export async function rotateRefreshToken(rawToken: string | undefined): Promise<RotateResult> {
  if (!rawToken) return { status: "invalid" };
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!existing) return { status: "invalid" };

  // Consumed or revoked token presented again ⇒ replay ⇒ nuke the family.
  if (existing.usedAt || existing.revokedAt) {
    const usedAgoMs = existing.usedAt ? Date.now() - existing.usedAt.getTime() : Infinity;
    // A revoked FAMILY means the user logged out (or theft was already
    // handled) — never grace back into a session that was deliberately ended.
    const familyRevoked =
      (await prisma.refreshToken.count({
        where: { familyId: existing.familyId, revokedAt: { not: null } },
      })) > 0;
    const withinGrace = !existing.revokedAt && !familyRevoked && usedAgoMs <= REFRESH_GRACE_MS;

    if (!withinGrace) {
      await revokeFamily(existing.familyId);
      return { status: "reuse", familyId: existing.familyId, userId: existing.userId };
    }

    // Benign concurrent rotation: mint a sibling in the same family and hand
    // it to this caller. The other caller keeps the token it already got.
    const gracedToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        familyId: existing.familyId,
        sessionId: existing.sessionId,
        tokenHash: hashToken(gracedToken),
        expiresAt: refreshExpiry(),
      },
    });
    return {
      status: "ok",
      userId: existing.userId,
      familyId: existing.familyId,
      sessionId: existing.sessionId,
      token: gracedToken,
      graced: true,
    };
  }
  if (existing.expiresAt < new Date()) {
    return { status: "invalid" };
  }

  const newToken = generateRefreshToken();
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: existing.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        familyId: existing.familyId,
        sessionId: existing.sessionId,
        tokenHash: hashToken(newToken),
        expiresAt: refreshExpiry(),
      },
    }),
  ]);

  return {
    status: "ok",
    userId: existing.userId,
    familyId: existing.familyId,
    sessionId: existing.sessionId,
    token: newToken,
  };
}

/** Revoke every refresh token in a family and its sessions. */
export async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await revokeSessionsByFamily(familyId);
}

/**
 * Revoke EVERY refresh-token family for a user — the other half of "sign out
 * everywhere". Sessions alone are not enough: a still-valid refresh cookie
 * mints a fresh access token on the next refresh, and that new token has no
 * Session row, so the revocation check treats it as legacy and allows it.
 * Killing the families closes the re-entry path.
 */
export async function revokeAllRefreshTokens(userId: string): Promise<number> {
  const res = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count;
}

/** Resolve the family id for a raw refresh token (used by logout). */
export async function getFamilyForToken(rawToken: string | undefined): Promise<string | null> {
  if (!rawToken) return null;
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { familyId: true },
  });
  return row?.familyId ?? null;
}
