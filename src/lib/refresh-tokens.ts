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
  | { status: "ok"; userId: string; familyId: string; sessionId: string | null; token: string }
  | { status: "reuse"; familyId: string; userId: string }
  | { status: "invalid" };

/**
 * Rotate a refresh token: consume the presented one and mint a replacement in
 * the same family. Presenting an already-consumed or revoked token is treated
 * as theft/replay and revokes the ENTIRE family (all tokens + sessions).
 */
export async function rotateRefreshToken(rawToken: string | undefined): Promise<RotateResult> {
  if (!rawToken) return { status: "invalid" };
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!existing) return { status: "invalid" };

  // Consumed or revoked token presented again ⇒ replay ⇒ nuke the family.
  if (existing.usedAt || existing.revokedAt) {
    await revokeFamily(existing.familyId);
    return { status: "reuse", familyId: existing.familyId, userId: existing.userId };
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

/** Resolve the family id for a raw refresh token (used by logout). */
export async function getFamilyForToken(rawToken: string | undefined): Promise<string | null> {
  if (!rawToken) return null;
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { familyId: true },
  });
  return row?.familyId ?? null;
}
