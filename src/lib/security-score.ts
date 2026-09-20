/**
 * Pure, testable security-score computation used by the Security Center.
 *
 * Kept free of React / i18n / Prisma so the weights and tier thresholds can be
 * unit-tested in isolation. The SecurityCenter component feeds it data from
 * useSecurityData and maps the resulting score/tier onto localized copy.
 */

export interface SecurityScoreInput {
  /** Whether TOTP 2FA is enabled (null while still loading). */
  totpEnabled: boolean | null;
  /** Number of registered passkeys. */
  passkeyCount: number;
  /** Unused backup codes remaining (null while loading). */
  backupRemaining: number | null;
  /** Whether the account email address has been verified (null while loading). */
  emailVerified: boolean | null;
  /** Count of suspicious security events in the recent window. */
  suspiciousRecent: number;
  /** Number of active sessions. */
  sessionCount: number;
  /**
   * Whether the user verified with an MFA method (TOTP, passkey, or backup
   * code) within the recency window — rewards actual verification, not just
   * enrollment.
   */
  mfaVerifiedRecently: boolean;
}

export const SECURITY_SCORE_MAX = 100;

const TOTP_WEIGHT = 20;
const PASSKEY_WEIGHT = 15;
const BACKUP_WEIGHT = 10;
const EMAIL_VERIFIED_WEIGHT = 15;
const MFA_VERIFIED_WEIGHT = 15;
const NO_SUSPICIOUS_WEIGHT = 15;
const SESSION_WEIGHT = 10;

export function computeSecurityScore(input: SecurityScoreInput): number {
  let score = 0;
  if (input.totpEnabled) score += TOTP_WEIGHT;
  if (input.passkeyCount > 0) score += PASSKEY_WEIGHT;
  if ((input.backupRemaining ?? 0) > 0) score += BACKUP_WEIGHT;
  if (input.emailVerified) score += EMAIL_VERIFIED_WEIGHT;
  if (input.mfaVerifiedRecently) score += MFA_VERIFIED_WEIGHT;
  if (input.suspiciousRecent === 0) score += NO_SUSPICIOUS_WEIGHT;
  if (input.sessionCount <= 2) score += SESSION_WEIGHT;
  return Math.min(SECURITY_SCORE_MAX, Math.max(0, score));
}

export type SecurityScoreTier = "great" | "good" | "fair" | "weak";

/** Map a score to a severity tier, used to pick the localized banner message. */
export function scoreTier(score: number): SecurityScoreTier {
  if (score >= 80) return "great";
  if (score >= 50) return "good";
  if (score >= 25) return "fair";
  return "weak";
}

/** Banner accent color for a given score (keep in sync with scoreTier). */
export function scoreColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 50) return "#f59e0b";
  if (score >= 25) return "#f97316";
  return "#ef4444";
}

/**
 * Security-event types that indicate the account is under active pressure.
 * When any occur in the recent window, the score drops the no-suspicious
 * component.
 */
export const SUSPICIOUS_EVENT_TYPES: ReadonlySet<string> = new Set([
  "LOGIN_FAILED",
  "ACCOUNT_LOCKED",
  "SESSION_REVOKED",
  "SESSIONS_REVOKED_ALL",
  "REFRESH_REUSE",
]);

export function isSuspiciousEventType(type: string): boolean {
  return SUSPICIOUS_EVENT_TYPES.has(type);
}

/**
 * Event types that count as a successful MFA verification — a real proof of a
 * second factor, not just enrollment. Used to reward verified usage of MFA.
 */
export const MFA_VERIFICATION_EVENT_TYPES: ReadonlySet<string> = new Set([
  "MFA_VERIFIED",
  "PASSKEY_LOGIN",
  "BACKUP_CODE_USED",
]);

export function isMfaVerificationEventType(type: string): boolean {
  return MFA_VERIFICATION_EVENT_TYPES.has(type);
}

/** Protections the account has not yet set up (ordered by weight). */
export type MissingProtection = "totp" | "passkey" | "backup" | "email" | "mfaFresh";

const MISSING_WEIGHT: Record<MissingProtection, number> = {
  totp: TOTP_WEIGHT,
  passkey: PASSKEY_WEIGHT,
  backup: BACKUP_WEIGHT,
  email: EMAIL_VERIFIED_WEIGHT,
  mfaFresh: MFA_VERIFIED_WEIGHT,
};

/**
 * Which protections the account is actually missing, heaviest first — the
 * input the component-aware score banner names instead of a static per-tier
 * sentence (which contradicted e.g. an enabled 2FA under the "enable 2FA"
 * copy). `mfaFresh` only counts when TOTP is on but stale (>30 days since a
 * real verification) — enrollment alone is not the fresh proof the policy
 * rewards.
 */
export function missingProtections(input: SecurityScoreInput): MissingProtection[] {
  const missing: MissingProtection[] = [];
  if (!input.totpEnabled) missing.push("totp");
  if (input.passkeyCount === 0) missing.push("passkey");
  if ((input.backupRemaining ?? 0) === 0) missing.push("backup");
  if (!input.emailVerified) missing.push("email");
  if (input.totpEnabled && !input.mfaVerifiedRecently) missing.push("mfaFresh");
  return missing.sort((a, b) => MISSING_WEIGHT[b] - MISSING_WEIGHT[a]);
}

/**
 * How the score banner should talk: name the missing protections, or confirm
 * that every protection is active. The old fallback made a "good"-tier
 * account with every protection enrolled read "enable two-factor
 * authentication" right above an enabled 2FA card — session pressure
 * (deductions) is separate from missing protections.
 */
export type ScoreBannerMode = "missing" | "complete";

export function scoreBannerMode(input: SecurityScoreInput): ScoreBannerMode {
  return missingProtections(input).length === 0 ? "complete" : "missing";
}

/** Recency window (days) for which an MFA verification still counts. */
export const MFA_VERIFIED_RECENT_DAYS = 30;

/**
 * Whole days elapsed since the last MFA verification — the visible counter
 * behind the 30-day re-verification policy. null means "never verified".
 * `nowMs` defaults to Date.now() but is injectable for tests.
 */
export function daysSinceMfaVerification(
  lastVerifiedAt: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (!lastVerifiedAt) return null;
  const then = new Date(lastVerifiedAt).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((nowMs - then) / 86_400_000));
}

/**
 * Days left before the 30-day re-verification is due (0 = due now).
 * null means "never verified" — the policy clock never started.
 */
export function daysUntilMfaReverificationDue(
  lastVerifiedAt: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  const since = daysSinceMfaVerification(lastVerifiedAt, nowMs);
  if (since === null) return null;
  return Math.max(0, MFA_VERIFIED_RECENT_DAYS - since);
}
