"use client";

import { useEffect } from "react";

/**
 * Bridge between the Recovery readiness panel and the card that owns a fix.
 *
 * The panel's "Do this next" button used to just scroll to the right card,
 * which made a button labelled "Set up 2FA" that did not set up 2FA. Each card
 * owns its own dialog state, and lifting all four into the page to wire one
 * button would be a lot of coupling for one affordance — so the panel announces
 * which fix was asked for and the owning card answers.
 *
 * The listener is keyed by the card's own element id, so a card can only ever
 * respond to the action aimed at it.
 */
export const RECOVERY_ACTION_EVENT = "recovery:action";

export type RecoveryActionTarget =
  "totp-card" | "email-verification" | "backup-authenticator-card" | "backup-codes-card";

/** Announce that the user asked for a specific fix. */
export function requestRecoveryAction(target: RecoveryActionTarget): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RECOVERY_ACTION_EVENT, { detail: { target } }));
}

/** Run `onTrigger` when the panel asks for THIS card's action. */
export function useRecoveryAction(target: RecoveryActionTarget, onTrigger: () => void): void {
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string }>).detail;
      if (detail?.target === target) onTrigger();
    };
    window.addEventListener(RECOVERY_ACTION_EVENT, handler);
    return () => window.removeEventListener(RECOVERY_ACTION_EVENT, handler);
    // `onTrigger` is a fresh closure every render in most callers; re-binding is
    // cheap and keeps the listener pointed at current state.
  }, [target, onTrigger]);
}
