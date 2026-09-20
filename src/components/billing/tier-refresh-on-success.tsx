"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

/**
 * Fires once when a user lands on the checkout-success page: re-fetches
 * /api/auth/me so the freshly purchased plan is reflected in the auth
 * context (tier badge, feature gates) immediately, then bounces to the
 * dashboard. Without this the success page renders with the pre-purchase
 * tier until a manual refresh.
 */
export function TierRefreshOnSuccess() {
  const router = useRouter();
  const pathname = usePathname();
  const { refreshUser } = useAuth();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (!pathname?.endsWith("/checkout/success")) return;
    fired.current = true;
    void refreshUser().then(() => router.refresh());
  }, [pathname, refreshUser, router]);

  return null;
}
