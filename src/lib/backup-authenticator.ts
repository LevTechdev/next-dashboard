import "server-only";

import { prisma } from "@/lib/db";
import { generateTotpSecret, totpKeyUri, verifyTotp } from "@/lib/totp";
import { spendBackupTotp } from "@/lib/totp-replay";

/**
 * The backup authenticator: a SECOND authenticator app enrolled on a different
 * device, accepted at the same TOTP step as the primary secret.
 *
 * Why it exists — the recovery ladder for a lost phone used to be: backup
 * recovery code → emailed account recovery. Both are strictly worse than the
 * factor you already trust:
 *
 *   - a recovery CODE is a bearer string the user has to keep somewhere (and
 *     one they may never have generated),
 *   - emailed recovery disables 2FA entirely and signs every device out.
 *
 * A second enrolled authenticator closes that gap: if the phone with the
 * primary secret is gone, the spare still proves possession, and 2FA is never
 * turned off at all.
 *
 * Storage mirrors `User.totpSecret` exactly (base32 secret, same verify path),
 * so the two sources are interchangeable at the login step and nothing about
 * the existing primary flow changes.
 */

/** Longest label we store (the client shows it verbatim in the Security Center). */
const MAX_LABEL_LENGTH = 60;

/** Trim and bound a user-supplied device label; blank becomes null. */
export function normalizeLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, MAX_LABEL_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

export interface EnrollmentOffer {
  /** base32 secret — echoed back on confirm (never persisted before that). */
  secret: string;
  /** otpauth:// URI for the QR / manual entry. */
  otpauth: string;
  label: string;
}

/**
 * Mint a secret to show the user. Nothing is stored yet: the secret only
 * becomes a backup authenticator once a code generated from it verifies, so an
 * abandoned enrollment can never leave a half-registered factor behind.
 */
export async function offerBackupAuthenticator(opts: {
  email: string;
  label?: unknown;
}): Promise<EnrollmentOffer> {
  const secret = await generateTotpSecret();
  return {
    secret,
    otpauth: totpKeyUri({ issuer: "Dashboard", email: opts.email, secret }),
    label: normalizeLabel(opts.label) ?? "",
  };
}

/**
 * Confirm and persist an enrollment. A code generated from the offered secret
 * must verify first — the same "prove you can read it" step as primary setup.
 */
export async function confirmBackupAuthenticator(opts: {
  userId: string;
  secret: string;
  token: string;
  label?: unknown;
}): Promise<{ ok: true } | { ok: false; error: "INVALID_SECRET" | "INVALID_CODE" }> {
  if (!opts.secret || typeof opts.secret !== "string")
    return { ok: false, error: "INVALID_SECRET" };
  if (!opts.token || typeof opts.token !== "string" || opts.token.length < 6) {
    return { ok: false, error: "INVALID_CODE" };
  }
  if (!verifyTotp(opts.token, opts.secret)) return { ok: false, error: "INVALID_CODE" };

  const label = normalizeLabel(opts.label);
  // Upsert, not create: re-enrolling replaces the previous backup
  // authenticator rather than failing on the unique userId.
  await prisma.backupAuthenticator.upsert({
    where: { userId: opts.userId },
    // A new secret starts a fresh TOTP step sequence, so the replay counter is
    // cleared with it — carrying the old counter over would refuse valid codes
    // from the new secret until the clock caught up.
    create: { userId: opts.userId, secret: opts.secret, label },
    update: { secret: opts.secret, label, lastUsedAt: null, lastUsedStep: null },
  });

  return { ok: true };
}

/** Remove the backup authenticator (idempotent). */
export async function removeBackupAuthenticator(userId: string): Promise<void> {
  await prisma.backupAuthenticator.deleteMany({ where: { userId } });
}

/** What the Security Center card renders. Never exposes the secret. */
export async function getBackupAuthenticatorStatus(userId: string): Promise<{
  enrolled: boolean;
  label: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
  usable: boolean;
}> {
  const row = await prisma.backupAuthenticator.findUnique({ where: { userId } });
  return {
    enrolled: Boolean(row),
    label: row?.label ?? null,
    createdAt: row?.createdAt?.toISOString() ?? null,
    lastUsedAt: row?.lastUsedAt?.toISOString() ?? null,
    // A backup authenticator is only meaningful while 2FA itself is on.
    usable: Boolean(row),
  };
}

/**
 * Verify a TOTP token against the backup authenticator. Used by the login
 * route ONLY after the primary secret failed, so the common path costs no
 * extra query. On success the row records `lastUsedAt` — the Security Center
 * shows it, and it is the audit evidence that the spare really saved someone.
 *
 * Verification goes through the same single-use guard as the primary secret
 * (`spendBackupTotp`), so a spare code is spendable exactly once too.
 */
export async function verifyBackupAuthenticator(
  userId: string,
  token: string,
): Promise<{ ok: true; id: string } | { ok: false }> {
  if (!token) return { ok: false };
  const result = await spendBackupTotp(userId, token);
  if (!result.ok || !result.id) return { ok: false };
  return { ok: true, id: result.id };
}
