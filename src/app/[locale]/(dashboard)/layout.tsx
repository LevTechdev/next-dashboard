"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/page-transition";
import { ViewTransitionProvider } from "@/components/view-transition-provider";
import UnsupportedBrowserBanner from "@/components/unsupported-browser-banner";
import EmailVerificationBanner from "@/components/email-verification-banner";
import { AiCopilotProvider, AiCopilotButton, AiCopilotPanel } from "@/components/ai";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { RoleGuard } from "@/components/auth/role-guard";
import { canAccessPage, type Role } from "@/lib/permissions";
import { useAuth } from "@/hooks/use-auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile sidebar on route change (so it doesn't stay open after
  // clicking a nav item in the drawer) and on resize to desktop
  useEffect(() => {
    setMobileSidebarOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [pathname]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <ConfirmProvider>
      <AiCopilotProvider>
        <ViewTransitionProvider>
          <UnsupportedBrowserBanner />
          {/* min-h-dvh (not min-h-screen): on mobile the browser URL bar
              collapses/expands, and 100vh tracks the *largest* viewport, so a
              vh-based page is taller than the visible area and the bottom dock
              floats over a gap. dvh tracks the visible height, keeping the
              dock pinned correctly at the bottom. */}
          <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
              <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
            </div>

            {/* Mobile Sidebar Overlay */}
            {mobileSidebarOpen && (
              <div
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileSidebarOpen(false)}
              />
            )}

            {/* Mobile Sidebar Drawer */}
            <div
              className={cn(
                "fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out lg:hidden",
                mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
              )}
            >
              <div className="flex items-center justify-end h-16 px-4 border-b border-gray-200 dark:border-gray-800">
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              <Sidebar collapsed={false} onToggle={() => {}} embedded />
            </div>

            {/* Main Content */}
            <div
              className={cn(
                "transition-all duration-300",
                "lg:pl-64",
                sidebarCollapsed && "lg:pl-[72px]",
                "pb-16 lg:pb-0",
              )}
            >
              <Header onMenuClick={() => setMobileSidebarOpen(true)} />

              <main className="p-3 sm:p-4 lg:p-6 pb-24 lg:pb-6">
                <EmailVerificationBanner />
                <RoleGuard page={getPageKey(pathname)}>
                  <PageTransition>{children}</PageTransition>
                </RoleGuard>
              </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <MobileNav />
          </div>
        </ViewTransitionProvider>
        <AiCopilotButton />
        <AiCopilotPanel />
      </AiCopilotProvider>
    </ConfirmProvider>
  );
}

/** Extract the page key from a pathname like /en/team → "team". */
function getPageKey(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  // First part is locale, second is the page key
  return parts[1] || "dashboard";
}
