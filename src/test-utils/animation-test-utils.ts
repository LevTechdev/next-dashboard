import { beforeEach, afterEach, vi } from "vitest";
import { act } from "@testing-library/react";

// The timer APIs real framer-motion depends on. Its frame loop reads
// performance.now() as the animation clock and schedules renders through
// requestAnimationFrame; faking the setTimeout family too lets
// vi.advanceTimersByTime drive everything (including the rAF ticks) from a
// single call.
const ANIMATION_TIMERS = [
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "performance",
] as const;

// Minimal rAF-only set for hooks/components that clock their animation from
// the rAF callback's timestamp argument (e.g. useAnimatedCounter) instead of
// performance.now(). Only rAF is faked so performance.now()/Date stay real,
// exactly matching what those loops were written against.
const RAF_TIMERS = ["requestAnimationFrame", "cancelAnimationFrame"] as const;

type FakeTimerKey = (typeof ANIMATION_TIMERS)[number];

function installFakeTimers(toFake: readonly FakeTimerKey[]) {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: [...toFake] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

/**
 * Install deterministic fake timers for framer-motion tests.
 *
 * Call once inside a `describe` block (before any `it`s): it registers the
 * `beforeEach`/`afterEach` pair that enables the fake clock (rAF +
 * performance.now + the setTimeout family) and restores real timers
 * afterwards, so tests can advance framer-motion animations frame by frame
 * instead of waiting real time. Drive the clock with {@link advanceAnimation}.
 */
export function useAnimationTimers() {
  installFakeTimers(ANIMATION_TIMERS);
}

/**
 * Install deterministic fake timers for rAF-clock-driven animations
 * (useAnimatedCounter and friends), where only requestAnimationFrame is
 * faked. Call once inside a `describe` block, and drive the clock with
 * {@link advanceAnimationSync}.
 */
export function useRafTimers() {
  installFakeTimers(RAF_TIMERS);
}

/**
 * Advance the fake clock by `ms`, letting React flush (act) and microtasks
 * settle, so framer-motion animations driven by rAF + performance.now run to
 * the requested point (or completion). Prefer a budget comfortably larger
 * than the animation's `transition.duration` plus a few startup frames.
 */
export async function advanceAnimation(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * Synchronous variant of {@link advanceAnimation} for rAF-timestamp-driven
 * loops (useAnimatedCounter), where every state update happens inside the
 * rAF callback and settles synchronously within `act` — no microtask flush
 * needed.
 */
export function advanceAnimationSync(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}
