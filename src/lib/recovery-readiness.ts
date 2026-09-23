import { BACKUP_CODE_LOW_THRESHOLD } from "@/lib/backup-code-status";

/**
 * "If I lost this phone right now, could I still get into my account?"
 *
 * The Security Center used to answer that question only by accident: someone
 * could see "two-factor authentication is active" next to "0 recovery codes"
 * and "no spare device" and conclude they were protected — they were, against
 * everyone else, and not at all against their own lost phone.
 *
 * This module is the honest answer, computed from facts the page already has.
 * It is deliberately pure and returns *keys*, never prose: the panel is
 * localized in four languages and the server-side alerts need the same
 * thresholds, so the copy lives in the locales and the judgement lives here.
 *
 * The ladder it models, best to worst, for "the device holding my primary
 * authenticator is gone":
 *
 *   spare authenticator → same factor, no downgrade, nothing to disable
 *   recovery codes      → works offline, single-use, finite
 *   passkey             → works if it is one you still have (keychain-synced
 *                         passkeys usually survive; a device-bound one does not)
 *   verified email      → emailed sign-in code, or the last-resort recovery
 *                         that turns 2FA off entirely
 *
 * Nothing at all means there is no way back in — and if the email is also
 * unverified, not even the last-resort recovery can reach them.
 */

export type RecoveryPathId = "spareAuthenticator" | "recoveryCodes" | "passkey" | "email";

export type RecoveryPathState = "available" | "missing" | "unknown";

export type ReadinessLevel =
  /** Still loading — claim nothing yet. */
  | "unknown"
  /** 2FA is off, so there is no second factor to recover from. */
  | "unprotected"
  /** 2FA is on with no path back in at all. */
  | "locked-out"
  /** A path exists, but it is a weaker one than the factor being protected. */
  | "thin"
  /** The primary device can be lost without any downgrade. */
  | "ready";

export type RecoveryNextAction = "enable2fa" | "verifyEmail" | "addSpare" | "generateCodes";

export interface RecoveryPath {
  id: RecoveryPathId;
  state: RecoveryPathState;
  /** Unused recovery codes left, when relevant — drives the low-codes nuance. */
  remaining?: number;
}

export interface RecoveryReadiness {
  level: ReadinessLevel;
  paths: RecoveryPath[];
  /** Paths known to work right now (excludes unknown). */
  availableCount: number;
  /** Whether losing the primary device still leaves a way in. */
  canRecover: boolean;
  /** Codes are running out but a weaker path still exists. */
  codesLow: boolean;
  /** The ONE thing worth doing next; null when there is nothing to fix. */
  nextAction: RecoveryNextAction | null;
}

export interface RecoveryFacts {
  totpEnabled: boolean | null;
  /** null while the spare-authenticator status is still loading. */
  spareEnrolled: boolean | null;
  /** null while the backup-code count is still loading. */
  backupRemaining: number | null;
  /** null while passkeys are still loading. */
  passkeyCount: number | null;
  /** ISO timestamp of email verification, or null when unverified. */
  emailVerified: string | null;
}

/** Whether the codes path is a *thin* one on its own. */
export function recoveryCodesLow(remaining: number | null): boolean {
  return remaining !== null && remaining <= BACKUP_CODE_LOW_THRESHOLD;
}

/**
 * The shape `recoveryFactsFrom` needs — structurally the fields the Security
 * Center's shared hook already exposes. Declared as a structural type rather
 * than importing `SecurityData` so this module stays pure (no `"use client"`
 * boundary) and remains usable from the server.
 */
export interface RecoveryFactSource {
  totpEnabled: boolean | null;
  backupAuthenticator: { enrolled: boolean } | null;
  backupRemaining: number | null;
  passkeys: readonly unknown[];
  loading: boolean;
  emailVerified: string | null;
}

/**
 * Read the readiness facts out of the Security Center's data.
 *
 * One place, so the panel and the destructive-action guards can never disagree
 * about what the account has: a guard that thinks you have a spare while the
 * panel thinks you don't is worse than no guard at all.
 */
export function recoveryFactsFrom(src: RecoveryFactSource): RecoveryFacts {
  return {
    totpEnabled: src.totpEnabled,
    spareEnrolled: src.backupAuthenticator?.enrolled ?? null,
    backupRemaining: typeof src.backupRemaining === "number" ? src.backupRemaining : null,
    // While the first fetch is in flight, `passkeys` is an empty array that
    // means "not loaded", not "none" — passing null keeps the panel from
    // calling a keychain-backed account locked out as it loads. A partial
    // payload (a story, a focused test) reads as unknown rather than throwing.
    passkeyCount: src.loading || !Array.isArray(src.passkeys) ? null : src.passkeys.length,
    emailVerified: src.emailVerified,
  };
}

/** A destructive change to the account's recovery ladder. */
export type RecoveryRemovalAction =
  /** Turn the second factor off entirely. */
  | "disable2fa"
  /** Delete the spare authenticator device. */
  | "removeSpare";

export interface RecoveryActionImpact {
  action: RecoveryRemovalAction;
  /** The readiness the account would have once the action completed. */
  after: RecoveryReadiness;
  /**
   * The action destroys the last way back into the account: with it done, a lost
   * phone means an emailed recovery (which turns 2FA off) or nothing at all.
   */
  leavesNoWayBack: boolean;
  /** Explicit acknowledgement must be given before the action may proceed. */
  requiresAcknowledgement: boolean;
}

/**
 * Judge a destructive action BEFORE it happens.
 *
 * The confirmation dialogs used to ask for a password and nothing else, which
 * answers "are you you?" but never "do you understand what this does?". Two
 * cases deserve more than a click:
 *
 *   - removing the spare, when it is the last path back in (no recovery codes,
 *     no passkey, no verified email) — afterwards a lost phone is a lost
 *     account, and there is nothing on screen to say so;
 *   - disabling 2FA, which always gives up the factor those paths were
 *     protecting.
 */
export function recoveryImpactOf(
  facts: RecoveryFacts,
  action: RecoveryRemovalAction,
): RecoveryActionImpact {
  const after =
    action === "disable2fa"
      ? recoveryReadiness({ ...facts, totpEnabled: false })
      : recoveryReadiness({ ...facts, spareEnrolled: false });

  // "Locked out" only ever means: 2FA is on and no path back exists. Disabling
  // 2FA cannot produce it — losing the second factor cannot lock you out of an
  // account that no longer has one — so it is judged separately.
  const leavesNoWayBack = after.level === "locked-out";

  return {
    action,
    after,
    leavesNoWayBack,
    requiresAcknowledgement:
      action === "disable2fa" ? facts.totpEnabled !== false : leavesNoWayBack,
  };
}

// ─── Drift: readiness across days ────────────────────────────────────────────

/**
 * Days of history kept in view. Declared here (not in the server-only drift
 * module) because the Security Center sparkline is a client component and must
 * not import a `server-only` file to learn the window width.
 */
export const READINESS_HISTORY_DAYS = 30;

/**
 * Ordering used to compare two verdicts. Higher is better protected.
 *
 * `unknown` is ranked below everything and is never compared against: it means
 * "not measured yet", not "bad", and reading it as a drop would fire the
 * alert the first time the page loaded.
 */
export const READINESS_RANK: Record<ReadinessLevel, number> = {
  unknown: -1,
  unprotected: 0,
  "locked-out": 1,
  thin: 2,
  ready: 3,
};

/**
 * The levels that exist while a second factor is on — the axis a "drop" is
 * measured along.
 *
 * `unprotected` (2FA switched off) is deliberately outside it: it is a change
 * on the *protection* axis, not the recovery one, and it already raises its own
 * much louder alert (`SECURITY_ALERT_SENT`, "2FA was turned off"). Firing a
 * second "your recovery got weaker" alert next to it would describe the same
 * event twice in different words.
 */
const LADDER_LEVELS: readonly ReadinessLevel[] = ["locked-out", "thin", "ready"];

export function onRecoveryLadder(level: ReadinessLevel): boolean {
  return LADDER_LEVELS.includes(level);
}

/** A move down the recovery ladder. */
export interface ReadinessDrop {
  from: ReadinessLevel;
  to: ReadinessLevel;
}

/**
 * Detect the transition worth telling the user about: the account was covered
 * and is not any more (or was fragile and is now locked out).
 *
 * Returns null for every other change — improvements, the first observation,
 * anything involving `unknown`, and moves that leave the ladder.
 */
export function readinessDrop(
  previous: ReadinessLevel | null | undefined,
  current: ReadinessLevel,
): ReadinessDrop | null {
  if (!previous) return null;
  if (!onRecoveryLadder(previous) || !onRecoveryLadder(current)) return null;
  if (READINESS_RANK[current] >= READINESS_RANK[previous]) return null;
  return { from: previous, to: current };
}

export type ReadinessTrend = "up" | "down" | "flat";

/**
 * Where the account started vs where it is now, over a window of measured
 * days. Only ladder verdicts count (an unprotected stretch says nothing about
 * recoverability), and a window with fewer than two of them is `flat` — one
 * point is a fact, not a trend.
 */
export function readinessTrend(
  levels: readonly (ReadinessLevel | null | undefined)[],
): ReadinessTrend {
  const measured = levels.filter((l): l is ReadinessLevel => !!l && onRecoveryLadder(l));
  if (measured.length < 2) return "flat";
  const first = READINESS_RANK[measured[0]];
  const last = READINESS_RANK[measured[measured.length - 1]];
  if (last > first) return "up";
  if (last < first) return "down";
  return "flat";
}

export function recoveryReadiness(facts: RecoveryFacts): RecoveryReadiness {
  const path = (id: RecoveryPathId, state: RecoveryPathState, remaining?: number) =>
    remaining === undefined ? { id, state } : { id, state, remaining };

  const codeState: RecoveryPathState =
    facts.backupRemaining === null
      ? "unknown"
      : facts.backupRemaining > 0
        ? "available"
        : "missing";
  const passkeyState: RecoveryPathState =
    facts.passkeyCount === null ? "unknown" : facts.passkeyCount > 0 ? "available" : "missing";
  const spareState: RecoveryPathState =
    facts.spareEnrolled === null ? "unknown" : facts.spareEnrolled ? "available" : "missing";
  const emailState: RecoveryPathState = facts.emailVerified ? "available" : "missing";

  const paths: RecoveryPath[] = [
    path("spareAuthenticator", spareState),
    path("recoveryCodes", codeState, facts.backupRemaining ?? undefined),
    path("passkey", passkeyState),
    // An unverified email is a known-missing path, not an unknown one: the API
    // reports null for "not verified", so there is nothing left to wait for.
    path("email", emailState),
  ];

  const availableCount = paths.filter((p) => p.state === "available").length;
  const codesLow = recoveryCodesLow(facts.backupRemaining);

  // Unknown totals must not be read as "you have nothing" — the panel would
  // accuse a fully protected account of being locked out while it loads.
  if (facts.totpEnabled === null) {
    return {
      level: "unknown",
      paths,
      availableCount,
      canRecover: true,
      codesLow,
      nextAction: null,
    };
  }

  if (!facts.totpEnabled) {
    return {
      level: "unprotected",
      paths,
      availableCount,
      canRecover: true,
      codesLow,
      // With no second factor there is nothing to be locked out of; the only
      // thing missing is the second factor itself.
      nextAction: "enable2fa",
    };
  }

  const spareAvailable = spareState === "available";

  if (availableCount === 0) {
    return {
      level: "locked-out",
      paths,
      availableCount,
      canRecover: false,
      codesLow,
      // Recovery codes / a spare both need an authenticated session to set up.
      // An unverified email is the one gap that can be closed on the way back
      // in, and without it even the last-resort recovery cannot reach them.
      nextAction: emailState === "available" ? "addSpare" : "verifyEmail",
    };
  }

  if (!spareAvailable) {
    return {
      level: "thin",
      paths,
      availableCount,
      canRecover: true,
      codesLow,
      // The strongest available upgrade: recovering with the spare never turns
      // 2FA off, unlike the emailed paths.
      nextAction: "addSpare",
    };
  }

  return {
    level: "ready",
    paths,
    availableCount,
    canRecover: true,
    codesLow,
    // Covered. A depleted code set is worth topping up, but it is not a hole —
    // the spare already answers the lost-phone case.
    nextAction: facts.backupRemaining === 0 ? "generateCodes" : null,
  };
}
