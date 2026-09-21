/**
 * Backup-code posture — how many recovery codes are left, and whether that
 * count warrants a warning.
 *
 * Deliberately dependency-free (no `server-only`): the Security Center card,
 * the login recovery step, and the server-side alert all judge the same number,
 * so the threshold lives in exactly one place. A code is burned on EVERY
 * recovery sign-in, so a healthy-looking set can empty out in a bad week — and
 * the user has no way back in if the authenticator is gone too.
 */

/** Warn at or below this many unused codes. */
export const BACKUP_CODE_LOW_THRESHOLD = 2;

export type BackupCodeStatus = "unknown" | "ok" | "low" | "exhausted";

/**
 * Classify an unused-code count. `null`/`undefined` means the count has not
 * loaded yet — callers render a placeholder rather than a warning.
 */
export function backupCodeStatus(remaining: number | null | undefined): BackupCodeStatus {
  if (remaining === null || remaining === undefined || Number.isNaN(remaining)) {
    return "unknown";
  }
  if (remaining <= 0) return "exhausted";
  if (remaining <= BACKUP_CODE_LOW_THRESHOLD) return "low";
  return "ok";
}

/** True when the user should be nudged to generate a fresh set. */
export function needsBackupCodeWarning(remaining: number | null | undefined): boolean {
  const status = backupCodeStatus(remaining);
  return status === "low" || status === "exhausted";
}
