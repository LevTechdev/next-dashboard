import "server-only";

import { prisma } from "@/lib/db";
import { verifyTotpDetailed, type TotpFailureReason } from "@/lib/totp";

/**
 * Single-use enforcement for TOTP codes (RFC 6238 §5.2).
 *
 * A TOTP code is not a one-shot value: it stays valid for its entire 30-second
 * time step, plus whatever drift tolerance the verifier allows. Anything that
 * can observe the code — a shoulder, a screen recording, a log line, a phishing
 * relay, a compromised TLS proxy — can replay it for that whole window. RFC
 * 6238's answer is to remember the last time step a verifier accepted for a
 * secret and refuse anything at or below it.
 *
 * Why this matters more now than it used to: a code can be checked against TWO
 * secrets (the primary and the spare device), and codes flow through four
 * endpoints (login, step-up, re-verify). The counter is therefore kept **per
 * secret**, not per endpoint, so a code spent at sign-in cannot be spent again
 * at step-up seconds later — and spending a spare's code never invalidates the
 * primary's.
 *
 * Claiming is a conditional write, not a read-then-write: two concurrent
 * requests holding the same code race on
 * `UPDATE ... WHERE lastUsedStep < :step`, and exactly one wins.
 */

export type TotpSource = "primary" | "backup";

export type TotpSpendResult =
  | { ok: true; timeStep: number; id?: string }
  | { ok: false; reason: TotpFailureReason | "NOT_ENROLLED" };

/** The primary authenticator (User.totpSecret). */
export async function spendPrimaryTotp(userId: string, token: string): Promise<TotpSpendResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpLastUsedStep: true },
  });
  if (!user?.totpSecret) return { ok: false, reason: "NOT_ENROLLED" };

  const result = verifyTotpDetailed(token, user.totpSecret, {
    afterTimeStep: user.totpLastUsedStep,
  });
  if (!result.valid) return { ok: false, reason: result.reason };

  const claimed = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: result.timeStep } }],
    },
    data: { totpLastUsedStep: result.timeStep },
  });
  // Lost the race: another request spent this step (or a later one) first.
  if (claimed.count === 0) return { ok: false, reason: "REPLAY" };
  return { ok: true, timeStep: result.timeStep };
}

/**
 * The spare authenticator (BackupAuthenticator.secret). Records `lastUsedAt`
 * on success — it is the audit evidence that the spare really rescued someone,
 * and the Security Center shows it.
 */
export async function spendBackupTotp(userId: string, token: string): Promise<TotpSpendResult> {
  const row = await prisma.backupAuthenticator.findUnique({
    where: { userId },
    select: { id: true, secret: true, lastUsedStep: true },
  });
  if (!row) return { ok: false, reason: "NOT_ENROLLED" };

  const result = verifyTotpDetailed(token, row.secret, {
    afterTimeStep: row.lastUsedStep,
  });
  if (!result.valid) return { ok: false, reason: result.reason };

  const claimed = await prisma.backupAuthenticator.updateMany({
    where: {
      id: row.id,
      OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: result.timeStep } }],
    },
    data: { lastUsedStep: result.timeStep, lastUsedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false, reason: "REPLAY" };
  return { ok: true, timeStep: result.timeStep, id: row.id };
}
