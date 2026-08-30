import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useResendCooldown,
  RESEND_COOLDOWN_SECONDS,
  COOLDOWN_KEY,
} from "../use-resend-cooldown";

describe("useResendCooldown", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a 60s cooldown with the default storage key", () => {
    const { result } = renderHook(() => useResendCooldown());
    expect(result.current.cooldownLeft).toBe(0);

    act(() => result.current.startCooldown());

    expect(result.current.cooldownLeft).toBe(RESEND_COOLDOWN_SECONDS);
    expect(localStorage.getItem(COOLDOWN_KEY)).toBeTruthy();
  });

  it("supports a custom duration and a custom storage key", () => {
    const { result } = renderHook(() =>
      useResendCooldown({ durationSeconds: 15, storageKey: "custom-cooldown" }),
    );

    act(() => result.current.startCooldown());

    expect(result.current.cooldownLeft).toBe(15);
    expect(localStorage.getItem("custom-cooldown")).toBeTruthy();
    // The default key is untouched.
    expect(localStorage.getItem(COOLDOWN_KEY)).toBeNull();
  });

  it("counts down once per second and clears the marker when it elapses", () => {
    const { result } = renderHook(() =>
      useResendCooldown({ durationSeconds: 3, storageKey: "k" }),
    );

    act(() => result.current.startCooldown());
    expect(result.current.cooldownLeft).toBe(3);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.cooldownLeft).toBe(1);
    expect(localStorage.getItem("k")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.cooldownLeft).toBe(0);
    expect(localStorage.getItem("k")).toBeNull();
  });

  it("restores an in-progress cooldown from localStorage on mount", () => {
    const future = Date.now() + 30_000;
    localStorage.setItem("custom-cooldown", String(future));

    const { result } = renderHook(() =>
      useResendCooldown({ durationSeconds: 60, storageKey: "custom-cooldown" }),
    );

    expect(result.current.cooldownLeft).toBe(30);
  });

  it("drops an expired persisted marker without starting a cooldown", () => {
    localStorage.setItem("custom-cooldown", String(Date.now() - 5000));

    const { result } = renderHook(() =>
      useResendCooldown({ storageKey: "custom-cooldown" }),
    );

    expect(result.current.cooldownLeft).toBe(0);
    expect(localStorage.getItem("custom-cooldown")).toBeNull();
  });

  it("keeps two instances with different keys fully independent", () => {
    const email = renderHook(() =>
      useResendCooldown({ durationSeconds: 60, storageKey: COOLDOWN_KEY }),
    );
    const reset = renderHook(() =>
      useResendCooldown({ durationSeconds: 10, storageKey: "forgot-password-cooldown-until" }),
    );

    act(() => email.result.current.startCooldown());
    expect(email.result.current.cooldownLeft).toBe(60);
    // The other instance is unaffected by a different-key cooldown.
    expect(reset.result.current.cooldownLeft).toBe(0);
    expect(localStorage.getItem(COOLDOWN_KEY)).toBeTruthy();
    expect(localStorage.getItem("forgot-password-cooldown-until")).toBeNull();

    act(() => reset.result.current.startCooldown());
    expect(reset.result.current.cooldownLeft).toBe(10);
    expect(localStorage.getItem("forgot-password-cooldown-until")).toBeTruthy();

    // Advancing time only ticks the active instance's countdown.
    act(() => {
      vi.advanceTimersByTime(11_000);
    });
    expect(email.result.current.cooldownLeft).toBe(49);
    expect(reset.result.current.cooldownLeft).toBe(0);
    expect(localStorage.getItem("forgot-password-cooldown-until")).toBeNull();
    expect(localStorage.getItem(COOLDOWN_KEY)).toBeTruthy();
  });
});
