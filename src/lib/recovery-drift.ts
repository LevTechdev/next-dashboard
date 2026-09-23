import "server-only";

import { prisma } from "@/lib/db";
import { logSecurityEvent } from "@/lib/security-events";
import {
  readinessDrop,
  recoveryReadiness,
  onRecoveryLadder,
  READINESS_HISTORY_DAYS,
  type ReadinessLevel,
  type RecoveryFacts,
  type RecoveryNextAction,
} from "@/lib/recovery-readiness";

export { READINESS_HISTORY_DAYS };

/**
 * Recovery readiness over time.
 *
 * The Security Center panel answers "could I still get in?" for *now*. The
 * answer changes on its own: a recovery code is spent at sign-in, a spare
 * device is wiped with the phone it lived on, an email verification lapses when
 * the address is changed. None of those announce themselves, and the day the
 * answer changes is exactly the day it matters.
 *
 * So each account's verdict is recorded once per UTC day (a second capture the
 * same day updates the row instead of appending noise), and a move DOWN the
 * recovery ladder — covered → fragile, fragile → locked out — raises an in-app
 * alert the moment it is observed.
 *
 * The judgement itself lives in `src/lib/recovery-readiness.ts` (pure, shared
 * with the panel and the destructive-action guards); this module only reads
 * facts, persists the verdict, and speaks up.
 */

/** UTC calendar day key — the series is a day-per-row, so the key is a label. */
export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Human words for the verdicts, matching the panel's English copy. */
const LEVEL_PHRASE: Record<ReadinessLevel, string> = {
  ready: "covered",
  thin: "fragile",
  "locked-out": "locked out",
  unprotected: "not protected",
  unknown: "unknown",
};

const NEXT_ACTION_PHRASE: Record<RecoveryNextAction, string> = {
  enable2fa: "Turn two-factor authentication back on.",
  verifyEmail: "Verify your email address — it is the only route back that works from outside.",
  addSpare: "Add a spare authenticator on another device.",
  generateCodes: "Generate a fresh set of recovery codes.",
};

/**
 * Read the readiness facts for one account straight from the database.
 *
 * `null` facts mean "not loaded" to the pure module, which would report
 * `unknown`; the server always has the real answer, so nothing here is null
 * except the fields that are genuinely absent.
 */
export async function recoveryFactsForUser(userId: string): Promise<RecoveryFacts | null> {
  const [user, spare, unusedCodes, passkeys] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { totpEnabled: true, emailVerified: true },
    }),
    prisma.backupAuthenticator.findUnique({ where: { userId }, select: { id: true } }),
    prisma.backupCode.count({ where: { userId, usedAt: null } }),
    prisma.webAuthnCredential.count({ where: { userId } }),
  ]);

  if (!user) return null;

  return {
    totpEnabled: user.totpEnabled,
    spareEnrolled: !!spare,
    backupRemaining: unusedCodes,
    passkeyCount: passkeys,
    emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
  };
}

export interface RecoveryCaptureResult {
  userId: string;
  day: string;
  level: ReadinessLevel;
  /**
   * The verdict this capture was compared against — the most recent earlier
   * observation, whether it was minutes or days ago.
   */
  previous: ReadinessLevel | null;
  /** Whether this capture crossed a drop worth alerting about. */
  dropped: boolean;
  /** Whether an alert was actually written (false when deduped or disabled). */
  notified: boolean;
}

/**
 * Record today's verdict and alert if the account moved down the ladder.
 *
 * The baseline it compares against is the most recent earlier observation —
 * today's row if this is a second capture today, otherwise the newest previous
 * day. That matters: a drop the user causes at 09:00 is reported at 09:05 when
 * they next open the panel, not a day later after the nightly sweep. Acting on
 * the same day is also what keeps it to one alert per day, since the alert
 * itself is deduped within 24h.
 *
 * Idempotent per day: capturing twice in a day updates the row, and an
 * unchanged verdict cannot raise a second alert.
 *
 * Returns null when the user does not exist.
 */
export async function captureRecoveryReadiness(
  userId: string,
  opts: { notify?: boolean; now?: Date } = {},
): Promise<RecoveryCaptureResult | null> {
  const now = opts.now ?? new Date();
  const day = utcDay(now);

  const facts = await recoveryFactsForUser(userId);
  if (!facts) return null;

  const readiness = recoveryReadiness(facts);
  const level = readiness.level;

  const todaysRow = await prisma.recoveryReadinessSnapshot.findFirst({
    where: { userId, day },
    select: { level: true },
  });
  const previousRow =
    todaysRow ??
    (await prisma.recoveryReadinessSnapshot.findFirst({
      where: { userId, day: { lt: day } },
      orderBy: { day: "desc" },
      select: { level: true },
    }));
  const previous = (previousRow?.level as ReadinessLevel | undefined) ?? null;

  await prisma.recoveryReadinessSnapshot.upsert({
    where: { userId_day: { userId, day } },
    create: {
      userId,
      day,
      level,
      availableCount: readiness.availableCount,
      codesLow: readiness.codesLow,
      paths: readiness.paths as unknown as object,
    },
    update: {
      level,
      availableCount: readiness.availableCount,
      codesLow: readiness.codesLow,
      paths: readiness.paths as unknown as object,
    },
  });

  const drop = readinessDrop(previous, level);
  if (!drop) {
    return { userId, day, level, previous, dropped: false, notified: false };
  }

  if (opts.notify === false) {
    return { userId, day, level, previous, dropped: true, notified: false };
  }

  const notified = await alertOnReadinessDrop(userId, drop.from, drop.to, readiness.nextAction);
  return { userId, day, level, previous, dropped: true, notified };
}

/**
 * Write the "your account recovery got weaker" alert for a drop.
 *
 * Deduped to one alert per day: the daily sweep and a Security Center visit can
 * both observe the same drop minutes apart, and two identical alerts for one
 * change reads as a bug. Best-effort — a failed alert never fails the capture.
 */
async function alertOnReadinessDrop(
  userId: string,
  from: ReadinessLevel,
  to: ReadinessLevel,
  nextAction: RecoveryNextAction | null,
): Promise<boolean> {
  const title = "Account recovery got weaker";
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recoveryLine =
    to === "locked-out"
      ? "There is no way back into this account if you lose the device with your authenticator."
      : "The remaining ways back in are weaker ones — a recovery code or an emailed link, both of which turn two-factor authentication off.";

  const description = [
    `Your recovery readiness went from ${LEVEL_PHRASE[from]} to ${LEVEL_PHRASE[to]}.`,
    recoveryLine,
    nextAction ? NEXT_ACTION_PHRASE[nextAction] : "Open the Security Center to see what changed.",
  ].join(" ");

  try {
    const already = await prisma.notification.findFirst({
      where: { userId, title, createdAt: { gte: since } },
      select: { id: true },
    });

    if (!already) {
      await prisma.notification.create({
        data: {
          userId,
          type: "alert",
          title,
          description,
          link: "/security",
        },
      });
    }

    // The activity feed records the transition too, so the drop is visible in
    // the account's own security trail and not only in the inbox.
    await logSecurityEvent({
      userId,
      type: "RECOVERY_READINESS_DROPPED",
      metadata: { from, to, nextAction },
    });

    return !already;
  } catch (err) {
    console.error("[recovery-drift] alert failed:", err);
    return false;
  }
}

export interface ReadinessSnapshotRow {
  day: string;
  level: ReadinessLevel;
  availableCount: number;
  codesLow: boolean;
}

/** The last `days` days of verdicts, oldest first, gaps omitted. */
export async function recoveryReadinessHistory(
  userId: string,
  days: number = READINESS_HISTORY_DAYS,
): Promise<ReadinessSnapshotRow[]> {
  const since = utcDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));

  const rows = await prisma.recoveryReadinessSnapshot.findMany({
    where: { userId, day: { gte: since } },
    orderBy: { day: "asc" },
    select: { day: true, level: true, availableCount: true, codesLow: true },
  });

  return rows.map((r) => ({
    day: r.day,
    level: r.level as ReadinessLevel,
    availableCount: r.availableCount,
    codesLow: r.codesLow,
  }));
}

/**
 * Daily sweep for the scheduler: capture every account whose readiness is
 * meaningful and alert on any drop.
 *
 * Capturing on a schedule — not only when someone opens the Security Center —
 * is the whole point: a user who never visits the page still gets told the day
 * their recovery got weaker. 2FA-off accounts are included when they already
 * have history, so a series stays continuous instead of developing a hole at
 * the moment it became interesting.
 */
export async function runRecoveryDriftSweep(): Promise<{
  captured: number;
  dropped: number;
  failed: number;
}> {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ totpEnabled: true }, { readinessSnapshots: { some: {} } }],
    },
    select: { id: true },
    take: 2000,
  });

  let captured = 0;
  let dropped = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const result = await captureRecoveryReadiness(user.id);
      if (result) captured += 1;
      if (result?.dropped) dropped += 1;
    } catch (err) {
      failed += 1;
      console.error("[recovery-drift] capture failed for", user.id, err);
    }
  }

  return { captured, dropped, failed };
}

/** Whether an account's current verdict sits on the recovery ladder at all. */
export function isMeasured(level: ReadinessLevel): boolean {
  return onRecoveryLadder(level);
}
