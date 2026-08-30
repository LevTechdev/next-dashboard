import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePrefersReducedMotion } from "../use-prefers-reduced-motion";

interface StubMediaQueryList {
  matches: boolean;
  listeners: Set<(e: MediaQueryListEvent) => void>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  /** Simulate the OS/browser preference changing. */
  setMatches(matches: boolean): void;
}

/** jsdom has no matchMedia — stub one whose matches we control. */
function stubMatchMedia(matches: boolean): StubMediaQueryList {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql: StubMediaQueryList = {
    matches,
    listeners,
    addEventListener: vi.fn((_type: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    }),
    removeEventListener: vi.fn((_type: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    }),
    setMatches(next: boolean) {
      mql.matches = next;
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
    },
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
  return mql;
}

beforeEach(() => {
  // jsdom ships without matchMedia; default the stub to "no preference".
  vi.stubGlobal("matchMedia", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePrefersReducedMotion", () => {
  it("returns false when the user has no reduced-motion preference", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when prefers-reduced-motion: reduce matches", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("reacts to live preference changes while mounted", () => {
    const mql = stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => mql.setMatches(true));
    expect(result.current).toBe(true);

    act(() => mql.setMatches(false));
    expect(result.current).toBe(false);
  });

  it("unsubscribes on unmount", () => {
    const mql = stubMatchMedia(false);
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it("safely returns false when matchMedia is unavailable", () => {
    // jsdom default: window.matchMedia is undefined → no crash, stays false.
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});
