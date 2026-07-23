"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useState, useEffect, useRef } from "react";
import { useViewTransition } from "@/components/view-transition-provider";
import PageProgressBar from "./page-progress-bar";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps page content with a view-transition-name so the View Transition API
 * can animate it independently of the persistent layout (navbar, sidebar).
 *
 * Also shows a brief loading spinner overlay during route changes.
 * The actual page animation (crossfade + slide) is handled by CSS
 * pseudo-elements in globals.css (::view-transition-old/new).
 */
export default function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname();
  const { isSupported } = useViewTransition();
  const [mounted, setMounted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const prevPathname = useRef(pathname);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  // Detect route changes and toggle loading overlay with smooth fade
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setShowOverlay(true);
      hideTimerRef.current = setTimeout(() => setShowOverlay(false), 600);
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [pathname]);

  if (!mounted) {
    return <div className={className}>{children}</div>;
  }

  const wrapperClass = ["view-transition-page", !isSupported && "vt-fallback-fade", className]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {/* ═══ PROGRESS BAR — top-of-page loading indicator ═══ */}
      <PageProgressBar />

      {/* The view-transition-name scopes the animation to this element,
          keeping the navbar & sidebar from fading during transitions.
          When the VT API isn't supported, key on pathname to remount the
          wrapper on each navigation, triggering the CSS fade fallback. */}
      <div
        key={!isSupported ? pathname : undefined}
        className={wrapperClass}
        style={{ viewTransitionName: "page-content" }}
      >
        {children}
      </div>

      {/* ═══ LOADING OVERLAY — kept mounted with opacity toggle for smooth fade ═══ */}
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center bg-zinc-50/80 dark:bg-[#0b0c11]/80 backdrop-blur-sm transition-all duration-200 ease-in-out ${
          showOverlay ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        role="progressbar"
        aria-label="Page is loading"
        aria-live="polite"
        aria-hidden={!showOverlay}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-7 w-7" role="presentation">
            <div className="absolute inset-0 rounded-full border-2 border-zinc-200 dark:border-zinc-800" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-zinc-900 dark:border-t-white animate-spin" />
          </div>
          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium tracking-wide">
            Loading
          </span>
        </div>
      </div>
    </>
  );
}
