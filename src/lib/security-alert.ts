import "server-only";

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { revokeAllTrustedDevices } from "@/lib/trusted-devices";

/**
 * "2FA was turned off" alert — and the one-click way to undo the damage.
 *
 * Completing an emailed account recovery disables two-factor authentication and
 * signs every device out. If the account owner did that on purpose, fine. If
 * they did not, the person who did is now sitting in a session, and the account
 * is permanently down one factor. That second case is what this covers:
 *
 *   CONFIRM route  → issue a single-use revoke token, email it to the owner,
 *                    log SECURITY_ALERT_SENT.
 *   REVOKE route   → the owner clicks "This wasn't me" and the account is
 *                    secured: every session / refresh family / trusted device
 *                    is revoked, and sign-in stays shut until the password is
 *                    replaced (see `passwordResetRequired`).
 *
 * Why the password matters: revoking sessions alone is not a fix. The attacker
 * used the account password to request the recovery, so they still have it and
 * would simply sign in again. Closing sign-in until a password reset completes
 * is the only version of "revoke" that actually evicts them.
 *
 * Token handling mirrors the recovery token module: only the SHA-256 is stored,
 * the row is single-use and time-boxed, and the claim is atomic. Single-use is
 * not about the action's safety (a revoke is idempotent) — it stops a mailbox
 * scanner that prefetches links from silently consuming the owner's click.
 */

/** A week to notice "2FA went off and I didn't do that", then act. */
export const SECURITY_ALERT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Password-reset window opened by the revoke — same hour as the normal flow. */
export const ALERT_RESET_TTL_MS = 60 * 60 * 1000;

export type SecurityAlertKind = "RECOVERY_2FA_DISABLED";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a revoke token, superseding any earlier unused one (only the newest
 * alert link in the inbox should be live).
 */
export async function issueSecurityAlertToken(
  userId: string,
  kind: SecurityAlertKind,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SECURITY_ALERT_TTL_MS);

  await prisma.$transaction([
    prisma.securityAlertToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.securityAlertToken.create({
      data: { userId, tokenHash: hashToken(token), kind, expiresAt },
    }),
  ]);

  return { token, expiresAt };
}

export type AlertTokenState = "INVALID" | "EXPIRED" | "USED" | "VALID";

/**
 * Read a revoke link WITHOUT consuming it, for the confirmation page the email
 * points at.
 *
 * This is what makes the link safe to email: a mailbox scanner that fetches the
 * page (or a JS-executing preview bot that runs it) only ever reaches this
 * read-only check. The single-use claim happens later, when the human presses
 * the button and the POST calls {@link consumeSecurityAlertToken} — so a
 * prefetch can no longer burn the one click that matters.
 */
export async function peekSecurityAlertToken(
  token: string,
): Promise<{ state: AlertTokenState; kind?: string }> {
  if (!token || typeof token !== "string") return { state: "INVALID" };

  const row = await prisma.securityAlertToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { kind: true, expiresAt: true, usedAt: true },
  });
  if (!row) return { state: "INVALID" };
  if (row.usedAt) return { state: "USED" };
  if (row.expiresAt.getTime() < Date.now()) return { state: "EXPIRED" };
  return { state: "VALID", kind: row.kind };
}

export type ConsumeAlertResult =
  { ok: true; userId: string; kind: string } | { ok: false; error: "INVALID" | "EXPIRED" | "USED" };

/**
 * Claim a revoke token. The guarded `updateMany` is the source of truth, so two
 * simultaneous clicks cannot both count as the one that secured the account.
 */
export async function consumeSecurityAlertToken(token: string): Promise<ConsumeAlertResult> {
  if (!token || typeof token !== "string") return { ok: false, error: "INVALID" };

  const row = await prisma.securityAlertToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, kind: true, expiresAt: true, usedAt: true },
  });
  if (!row) return { ok: false, error: "INVALID" };
  if (row.usedAt) return { ok: false, error: "USED" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, error: "EXPIRED" };

  const claim = await prisma.securityAlertToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claim.count !== 1) return { ok: false, error: "USED" };

  return { ok: true, userId: row.userId, kind: row.kind };
}

/**
 * Secure the account after a "this wasn't me": evict everything that was signed
 * in, then hold sign-in closed behind a password reset.
 *
 * The reset token uses the existing `verificationToken` columns, exactly like
 * the forgot-password flow, so the standard reset page and API complete the
 * recovery with no parallel machinery.
 */
export async function revokeAfterSecurityAlert(userId: string): Promise<{
  sessionsRevoked: number;
  resetToken: string;
}> {
  const now = new Date();
  const resetToken = randomBytes(32).toString("hex");

  const [sessions] = await prisma.$transaction([
    prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetRequired: true,
        verificationToken: resetToken,
        verificationTokenExpires: new Date(Date.now() + ALERT_RESET_TTL_MS),
      },
    }),
  ]);

  // Trusted-device grants live in another module (they carry their own
  // cookie/profile matching) — a stale "skip 2FA on this device" grant must not
  // outlive the revoke.
  await revokeAllTrustedDevices(userId);

  return { sessionsRevoked: sessions.count, resetToken };
}
