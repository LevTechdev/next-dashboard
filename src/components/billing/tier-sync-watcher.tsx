"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

/**
 * Refresh the auth context's cached user (and with it the subscription tier)
 * on key route transitions so plan changes apply instantly, without a
 * re-login:
 *
 * - /checkout/success — the Stripe/Midtrans return URL fires after the
 *   webhook (or the free-plan direct switch) has flipped the subscription
 *   row; re-fetching /api/auth/me picks up the new tier before the user
 *   reaches the dashboard.
 * - /billing — returning to billing (or landing on it post-upgrade)
 *   re-syncs so the tier badge and feature gates never show stale state.
 */
export function TierSyncWatcher() {
  const pathname = usePathname();
  const { refreshUser } = useAuth();

  useEffect(() => {
    if (!pathname) return;
    if (/\/checkout\/success$/.test(pathname) || /\/billing$/.test(pathname)) {
      void refreshUser();
    }
  }, [pathname, refreshUser]);

  return null;
}
