import "server-only";

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

/**
 * Account recovery for a user who lost BOTH the authenticator and every backup
 * recovery code. This is the last resort: without it the only way back in is a
 * manual database edit.
 *
 * Threat model — the emailed link is a bearer credential, so the design keeps
 * it strictly single-use and short-lived, and completing a recovery never
 * silently inherits the account's existing trust:
 *
 *  - only the SHA-256 of the token is stored (a DB leak can't be replayed),
 *  - 30-minute TTL,
 *  - CONSUMED ATOMICALLY (`updateMany` guarded on `usedAt: null`), so a
 *    double-clicked link cannot disable 2FA twice or race a second sign-in,
 *  - requesting one requires the account PASSWORD, so an attacker who only
 *    owns the inbox still can't start a recovery.
 */

/** How long an emailed recovery link stays valid. */
export const RECOVERY_TTL_MS = 30 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** SHA-256 of the requesting IP — kept for the audit trail, never matched. */
export function hashIp(ip: string | null): string | null {
  return ip ? createHash("sha256").update(ip).digest("hex") : null;
}

/**
 * Issue a recovery token for a user, invalidating any previous unused ones
 * (only the newest link in the inbox should work).
 */
export async function issueAccountRecoveryToken(
  userId: string,
  ipHash: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RECOVERY_TTL_MS);

  await prisma.$transaction([
    // Supersede older links: a second request must not leave two live tokens.
    prisma.accountRecoveryToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.accountRecoveryToken.create({
      data: { userId, tokenHash: hashToken(token), ipHash, expiresAt },
    }),
  ]);

  return { token, expiresAt };
}

export type ConsumeResult =
  { ok: true; userId: string } | { ok: false; error: "INVALID" | "EXPIRED" | "USED" };

/**
 * Consume a recovery token. Single-use, and the claim is atomic: the guarded
 * `updateMany` is the source of truth, so two simultaneous confirmations can
 * never both succeed.
 */
export async function consumeAccountRecoveryToken(token: string): Promise<ConsumeResult> {
  if (!token || typeof token !== "string") return { ok: false, error: "INVALID" };

  const row = await prisma.accountRecoveryToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!row) return { ok: false, error: "INVALID" };
  if (row.usedAt) return { ok: false, error: "USED" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, error: "EXPIRED" };

  const claim = await prisma.accountRecoveryToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claim.count !== 1) return { ok: false, error: "USED" };

  return { ok: true, userId: row.userId };
}

/**
 * Clear every second factor the account had, so the recovered user can sign in
 * with just their password and then set up a fresh authenticator.
 *
 * Also revokes all sessions and refresh-token families: a recovery means
 * "credentials may be compromised", so nothing that was already signed in
 * should keep working.
 */
export async function resetSecondFactorAndSessions(userId: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecret: null,
        // Cleared with the secret it counts: a fresh secret must start a fresh
        // TOTP step sequence (RFC 6238 §5.2).
        totpLastUsedStep: null,
        // The old codes belong to the old authenticator — a recovered account
        // must not keep a set the attacker may have printed.
        backupCodes: { deleteMany: {} },
      },
    }),
    // And the spare device goes with it. It is inert while 2FA is off, but it
    // would become valid again the moment the owner re-enrolled 2FA — handing
    // whoever enrolled it (an attacker, in the case this recovery is reacting
    // to) a working second factor on a freshly secured account.
    prisma.backupAuthenticator.deleteMany({ where: { userId } }),
    prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);
}
