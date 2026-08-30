"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { canAccessPage, type Role } from "@/lib/permissions";

/**
 * Client-side route guard — wraps dashboard pages to enforce role-based access.
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
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const role = (user?.role as Role) || null;
    if (!canAccessPage(page, role)) {
      // Redirect to dashboard with a warning
      router.replace(`/${locale}/dashboard`);
    }
  }, [isLoading, user, page, router, locale]);

  if (isLoading) {
    return (
      fallback ?? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      )
    );
  }

  const role = (user?.role as Role) || null;
  if (!canAccessPage(page, role)) {
    return null;
  }

  return <>{children}</>;
}
