"use client";

import { useEffect, useState } from "react";

/**
 * A clock that is safe to read during render.
 *
 * `Date.now()` inside a render pass — including inside `useMemo`, which React
 * runs while rendering — is an impure read: the server and the client never
 * agree on the value, so the memoised output can differ between the two sides
 * and React reports a hydration mismatch. Reading it once into state and
 * letting a timer refresh it keeps relative timestamps ("2 mins ago") live
 * while the value stays constant for the whole render.
 *
 * A minute is the default because every consumer here renders minute-granular
 * labels; pass a shorter interval for a per-second countdown.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (intervalMs <= 0) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
