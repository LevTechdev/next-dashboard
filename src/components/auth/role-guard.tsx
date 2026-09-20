"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { canAccessPageForTier, type Role, type ClientTier } from "@/lib/permissions";

/**
 * Client-side route guard — wraps dashboard pages to enforce role-based access.
 * For CLIENT roles the user's subscription tier additionally unlocks tier-gated
 * surfaces (analytics/reports for PRO+, integrations/SSO for ENTERPRISE).
 * Unauthorized users are redirected to /dashboard with a toast warning.
 */
export function RoleGuard({
  page,
  children,
  fallback,
}: {
  /** The page key to check against PAGE_ACCESS (e.g. "team", "settings") */
  page: string;
  children: React.ReactNode;
  /** What to show while auth is loading */
  fallback?: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";
  const { user, tierFeatures, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // Deep-link race guard: right after login the auth fetch may still be in
    // flight while isLoading briefly flips false with user === null. Bailing
    // out here (instead of evaluating access with role=null) preserves the
    // requested URL — e.g. /billing?tab=plans — until the session resolves.
    if (!user) return;

    const role = (user?.role as Role) || null;
    const tier: ClientTier =
      role === "CLIENT" || role === "CLIENT_ENTERPRISE"
        ? ((tierFeatures?.tier as ClientTier) ??
          (role === "CLIENT_ENTERPRISE" ? "ENTERPRISE" : "REGULAR"))
        : null;
    if (!canAccessPageForTier(page, role, tier)) {
      // Redirect to dashboard with a warning
      router.replace(`/${locale}/dashboard`);
    }
  }, [isLoading, user, tierFeatures, page, router, locale]);

  if (isLoading) {
    return (
      fallback ?? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )
    );
  }

  const role = (user?.role as Role) || null;
  // While the session has not resolved yet, hold the previous content (spinner
  // fallback) rather than unmounting — an anonymous-looking render would
  // otherwise flash blank and, worse, race the redirect above.
  if (!user) {
    return (
      fallback ?? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )
    );
  }
  const tier: ClientTier =
    role === "CLIENT" || role === "CLIENT_ENTERPRISE"
      ? ((tierFeatures?.tier as ClientTier) ??
        (role === "CLIENT_ENTERPRISE" ? "ENTERPRISE" : "REGULAR"))
      : null;
  if (!canAccessPageForTier(page, role, tier)) {
    return null;
  }

  return <>{children}</>;
}
