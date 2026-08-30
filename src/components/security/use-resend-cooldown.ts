"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cooldown between verification-email sends. Persisted in localStorage so a
 * refresh (which resets the inline dev link) can't be used to spam resends.
 * The API itself is idempotent (each send rotates the token), but the cooldown
 * prevents accidental token churn and mailbox flooding. Both the Security
 * Center card and the profile page share this hook (and the storage key), so a
 * send from one surface blocks the other until the cooldown elapses.
 */
export const RESEND_COOLDOWN_SECONDS = 60;
export const COOLDOWN_KEY = "email-verify-cooldown-until";

export interface ResendCooldownOptions {
  /** Cooldown length in seconds. Defaults to {@link RESEND_COOLDOWN_SECONDS}. */
  durationSeconds?: number;
  /** localStorage key that persists the deadline. Defaults to {@link COOLDOWN_KEY}. */
  storageKey?: string;
}

/**
 * Returns the seconds remaining before the next send is allowed (0 = ready).
 * `startCooldown()` begins a fresh countdown and persists the deadline; the
 * persisted marker is cleared exactly when the cooldown elapses so a later
 * mount doesn't restore a stale block.
 *
 * Options let callers customize the duration and the storage key, so separate
 * flows (e.g. verification OTP vs. forgot-password resets) keep independent
 * cooldowns. All existing callers keep the 60s / shared-key defaults.
 */
export function useResendCooldown(options: ResendCooldownOptions = {}) {
  const durationSeconds = options.durationSeconds ?? RESEND_COOLDOWN_SECONDS;
  const storageKey = options.storageKey ?? COOLDOWN_KEY;

  const [cooldownLeft, setCooldownLeft] = useState(0);
  // Tracks the previous value so the persisted marker is cleared exactly when
  // the cooldown transitions from active to 0 — not on mount or unmount.
  const prevCooldownRef = useRef(0);
  const cooldownActive = cooldownLeft > 0;

  // Restore a persisted cooldown across remounts / refreshes. An expired
  // marker is dropped immediately so it never lingers after the deadline.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const until = Number(raw);
        if (Number.isFinite(until) && until > Date.now()) {
          setCooldownLeft(Math.ceil((until - Date.now()) / 1000)); // eslint-disable-line react-hooks/set-state-in-effect
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      // localStorage may be blocked (private browsing, permissions)
    }
  }, [storageKey]);

  // Tick the countdown down once per second while active. Decrement-based so
  // the UI stays deterministic (fake timers, tab throttling, clock changes).
  useEffect(() => {
    if (!cooldownActive) return;
    const id = setInterval(() => {
      setCooldownLeft((left) => Math.max(0, left - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownActive]);

  // Drop the persisted marker exactly when the cooldown elapses (active → 0).
  useEffect(() => {
    const wasActive = prevCooldownRef.current > 0;
    prevCooldownRef.current = cooldownLeft;
    if (wasActive && cooldownLeft === 0) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }, [cooldownLeft, storageKey]);

  const startCooldown = () => {
    const until = Date.now() + durationSeconds * 1000;
    setCooldownLeft(durationSeconds);
    try {
      localStorage.setItem(storageKey, String(until));
    } catch {
      // ignore
    }
  };

  return { cooldownLeft, startCooldown };
}
