/**
 * "2m" / "3h" / "5d" — a compact age stamp for quoted data.
 *
 * Extracted from the FX settlement panel so every live-data badge (FX quotes,
 * telemetry, snapshots) reports the age of its quote in the same units rather
 * than each surface inventing its own phrasing. Deliberately unit-only: the
 * caller composes the sentence, so it stays translatable.
 */
export function relativeStamp(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}
