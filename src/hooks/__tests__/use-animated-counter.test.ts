import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnimatedCounter } from "../use-animated-counter";

describe("useAnimatedCounter", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial state with value 0 and isAnimating true", () => {
    const { result } = renderHook(() => useAnimatedCounter(100));

    expect(result.current.value).toBe(0);
    expect(result.current.displayed).toBe("0");
    expect(result.current.isAnimating).toBe(true);
    expect(typeof result.current.restart).toBe("function");
  });

  it("animates to the end value after enough time passes", () => {
    const { result } = renderHook(() => useAnimatedCounter(100));

    // Advance the full animation duration
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.value).toBe(100);
    expect(result.current.displayed).toBe("100");
    expect(result.current.isAnimating).toBe(false);
  });

  it("rounds the value by default", () => {
    const { result } = renderHook(() => useAnimatedCounter(99));

    // Advance enough to complete
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.displayed).toBe("99");
    // Verify the value is an integer (rounded)
    expect(Number.isInteger(result.current.value)).toBe(true);
  });

  it("applies formatFn for custom display", () => {
    const formatFn = (v: number) => `${v.toFixed(1)}%`;
    const { result } = renderHook(() =>
      useAnimatedCounter(99, { formatFn })
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.value).toBe(99);
    expect(result.current.displayed).toBe("99.0%");
  });

  it("respects a custom duration", () => {
    const { result } = renderHook(() =>
      useAnimatedCounter(100, { duration: 500 })
    );

    // Advance only part-way (250ms = 50% duration)
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.value).toBeGreaterThan(0);
    expect(result.current.value).toBeLessThan(100);
    expect(result.current.isAnimating).toBe(true);

    // Complete the remaining time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.value).toBe(100);
    expect(result.current.isAnimating).toBe(false);
  });

  it("supports startOnMount: false and does not start animating", () => {
    const { result } = renderHook(() =>
      useAnimatedCounter(100, { startOnMount: false })
    );

    expect(result.current.value).toBe(0);
    expect(result.current.isAnimating).toBe(false);
  });

  it("restart re-triggers the animation from 0", () => {
    const { result } = renderHook(() => useAnimatedCounter(100));

    // Complete the first animation
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.value).toBe(100);
    expect(result.current.isAnimating).toBe(false);

    // Restart the animation
    act(() => {
      result.current.restart();
    });

    expect(result.current.isAnimating).toBe(true);

    // Advance part-way and check that value is between 0 and 100
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.value).toBeGreaterThan(0);
    expect(result.current.value).toBeLessThan(100);

    // Complete
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.value).toBe(100);
    expect(result.current.isAnimating).toBe(false);
  });

  it("handles end=0 without error", () => {
    const { result } = renderHook(() => useAnimatedCounter(0));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.value).toBe(0);
    expect(result.current.displayed).toBe("0");
    expect(result.current.isAnimating).toBe(false);
  });

  it("handles negative end values", () => {
    const { result } = renderHook(() => useAnimatedCounter(-50));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.value).toBe(-50);
    expect(result.current.displayed).toBe("-50");
    expect(result.current.isAnimating).toBe(false);
  });

  it("cancels animation frame on unmount", () => {
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");

    const { unmount } = renderHook(() => useAnimatedCounter(100));

    unmount();

    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  describe("edge cases", () => {
    it("handles NaN end value without crashing", () => {
      const { result } = renderHook(() => useAnimatedCounter(NaN));

      // Initially value is 0; displayed=Math.round(0)="0"
      expect(result.current.value).toBe(0);
      expect(result.current.displayed).toBe("0");

      // After animation completes, value becomes NaN; displayed="NaN"
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.isAnimating).toBe(false);
      expect(result.current.displayed).toBe("NaN");
    });

    it("handles positive Infinity end value without crashing", () => {
      const { result } = renderHook(() => useAnimatedCounter(Infinity));

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.isAnimating).toBe(false);
      // Math.round(Infinity) returns Infinity
      expect(result.current.value).toBe(Infinity);
    });

    it("handles negative Infinity end value without crashing", () => {
      const { result } = renderHook(() => useAnimatedCounter(-Infinity));

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.isAnimating).toBe(false);
      expect(result.current.value).toBe(-Infinity);
    });

    it("handles very large numbers (Number.MAX_SAFE_INTEGER)", () => {
      const largeNum = Number.MAX_SAFE_INTEGER;
      const { result } = renderHook(() => useAnimatedCounter(largeNum));

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.value).toBe(largeNum);
      expect(result.current.isAnimating).toBe(false);
    });

    it("handles duration of 0 and completes immediately", () => {
      const { result } = renderHook(() =>
        useAnimatedCounter(100, { duration: 0 })
      );

      // With duration=0: elapsed/duration = 0/0 = NaN, Math.min(NaN,1) = NaN
      // NaN < 1 is false, so animation completes on the first rAF frame
      act(() => {
        vi.advanceTimersByTime(16); // ~1 frame to fire rAF
      });

      expect(result.current.value).toBe(100);
      expect(result.current.isAnimating).toBe(false);
    });

    it("handles negative duration without crashing", () => {
      const { result } = renderHook(() =>
        useAnimatedCounter(100, { duration: -500 })
      );

      // elapsed = timestamp - 0 = timestamp, progress = min(timestamp / -500, 1)
      // timestamp / -500 is negative, min(negative, 1) = negative
      // But timestamp advances, so after enough time elapsed > -500? No, negative stays negative
      // Actually this means progress is always negative, so progress < 1 is always true
      // and the animation runs forever until the rAF limit... but we can just check it doesn't crash
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should still exist without throwing
      expect(result.current).toBeDefined();
    });

    it("handles a very small decimal end value", () => {
      const { result } = renderHook(() => useAnimatedCounter(0.001));

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Final setValue(end) sets the raw value, but displayed still rounds
      // displayed = Math.round(0.001).toString() = "0"
      expect(result.current.displayed).toBe("0");
      expect(result.current.isAnimating).toBe(false);
    });

    it("handles a very small decimal with no rounding", () => {
      const { result } = renderHook(() =>
        useAnimatedCounter(0.001, { round: false })
      );

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // With round: false, .toFixed(1) gives "0.0"
      expect(result.current.value).toBeCloseTo(0.001, 3);
      expect(result.current.isAnimating).toBe(false);
    });
  });
});
