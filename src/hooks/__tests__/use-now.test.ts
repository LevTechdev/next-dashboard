import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useNow } from "../use-now";

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the clock once per tick, not once per render", () => {
    const { result, rerender } = renderHook(() => useNow(60_000));
    const first = result.current;
    expect(first).toBe(new Date("2026-09-20T10:00:00.000Z").getTime());

    // Half a minute passes with no tick. A re-render must keep the SAME value —
    // re-reading the clock mid-render is what produced the hydration mismatches
    // and made memos recompute on unrelated renders.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    rerender();
    expect(result.current).toBe(first);
  });

  it("advances by the interval once it elapses", () => {
    const { result } = renderHook(() => useNow(60_000));
    const first = result.current;

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current).toBe(first + 60_000);
  });

  it("honours a custom interval", () => {
    const { result } = renderHook(() => useNow(1_000));
    const first = result.current;

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(result.current).toBe(first + 3_000);
  });

  it("clears its interval on unmount", () => {
    const clearSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = renderHook(() => useNow(60_000));

    unmount();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("stays frozen when ticking is disabled", () => {
    const { result, rerender } = renderHook(() => useNow(0));
    const first = result.current;

    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    rerender();

    expect(result.current).toBe(first);
  });
});
