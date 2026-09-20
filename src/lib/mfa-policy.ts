import "server-only";

import { prisma } from "@/lib/db";
import { MFA_VERIFICATION_EVENT_TYPES } from "@/lib/security-score";

/**
 * MFA re-verification policy — a 30-day MFA freshness requirement.
 *
 * Enrollment is not enough: an account whose second factor has not been used
 * for 30 days has to re-prove it. The signal is the immutable SecurityEvent
 * trail (MFA_VERIFIED / PASSKEY_LOGIN / BACKUP_CODE_USED — the same types the
 * security score rewards), so the answer survives re-seeds of user rows and
 * cannot be client-forged.
 *
 *  - `isMfaVerificationStale` — the shared staleness check.
 *  - `isMfaReverificationDue` — convenience for the *soft* alert surface
 *    (profile banner): enrolled + stale = due.
 *
 * Enforcement stays soft on purpose: the profile page surfaces the alert and
 * the login flow offers the TOTP challenge, but a stale user is never locked
 * out. Hard-locking accounts whose owners have been on vacation for five weeks
 * is a support ticket factory; a visible "verify now" path is not.
 */

/** Days an MFA verification stays fresh. Matches the security-score window. */
export const MFA_REVERIFY_DAYS = 30;

/** Hard cap on the staleness lookback query (2× window), keeping the scan bounded. */
export const MFA_VERIFICATION_LOOKBACK_DAYS = 60;

/**
 * True when the user's most recent MFA verification event is older than the
 * 30-day freshness window (or absent entirely).
 *
 * `totpEnabled=false` is never stale — there is nothing to re-verify until the
 * user actually enrolls a second factor.
 */
export async function isMfaVerificationStale(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - MFA_VERIFICATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const last = await prisma.securityEvent.findFirst({
    where: {
      userId,
      type: { in: [...MFA_VERIFICATION_EVENT_TYPES] },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last) return true;
  const ageMs = Date.now() - new Date(last.createdAt).getTime();
  return ageMs > MFA_REVERIFY_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Soft-alert predicate for the profile surface: the user has MFA enrolled but
 * the factor has not been exercised within the freshness window, so the "verify
 * now" banner should be visible.
 */
export async function isMfaReverificationDue(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabled: true },
  });
  if (!user?.totpEnabled) return false;
  return isMfaVerificationStale(userId);
}
