/**
 * The dashboard session window's countdown math, as pure functions.
 *
 * The stay-login sentinel measures wall-clock deltas each tick but must only
 * CONSUME time the tab could actually observe: hidden tabs (rAF stopped,
 * timers throttled) and whole system sleeps freeze the countdown instead of
 * burning it — the pre-fix wall-clock countdown signed users out the moment
 * their laptop woke up, because ten minutes of sleep had "elapsed" without
 * the user ever seeing the warning card.
 *
 * Extraction is deliberate: the visibility branch is pure input→output, so it
 * is unit-testable without fake timers racing React's effects (a 1s interval
 * that never clears makes userEvent + fake timers hang the whole suite).
 */

/** One tick: drain the countdown only when the tab can observe it. */
export function advanceStayCountdown(
  carriedMs: number,
  wallDeltaMs: number,
  visible: boolean,
): { remaining: number; expired: boolean } {
  if (!visible) return { remaining: carriedMs, expired: false }; // frozen — delta not consumed
  const remaining = carriedMs - wallDeltaMs;
  return { remaining, expired: remaining <= 0 };
}

/** Clock face for the alert: m:ss with a zero-padded seconds half. */
export function formatStayClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
