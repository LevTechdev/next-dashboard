"use client";

import { useState, useEffect } from "react";
import { useViewTransition } from "@/components/view-transition-provider";
import { XIcon } from "lucide-animated";
import { AlertTriangle } from "lucide-react";

const DISMISSED_KEY = "codebuff-vt-banner-dismissed";

/**
 * A dismissible banner that appears when the browser doesn't support the
 * View Transition API (`document.startViewTransition`). The banner shows a
 * brief message and which modern browsers do support it.
 *
 * Once dismissed, the choice is persisted in localStorage and the banner
 * won't reappear across sessions.
 */
export default function UnsupportedBrowserBanner() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const { isSupported } = useViewTransition();

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "true");
    } catch {
      // localStorage may be blocked (e.g. private browsing, permissions)
      setDismissed(false);
    }
  }, []);

  // Never show on server or before hydration
  if (!mounted) return null;

  // API supported, or user dismissed — don't render
  if (isSupported || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // localStorage may be blocked in some environments
    }
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9998] bg-amber-50 dark:bg-amber-950/90 border-b border-amber-200 dark:border-amber-800"
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
          <strong className="font-semibold">Smooth page transitions aren&apos;t supported</strong>{" "}
          in this browser. Upgrade to <span className="font-medium">Chrome 111+</span>,{" "}
          <span className="font-medium">Edge 111+</span>,{" "}
          <span className="font-medium">Firefox 128+</span>,{" "}
          <span className="font-medium">Safari 18+</span>, or{" "}
          <span className="font-medium">Opera 97+</span> for the best experience.
        </p>
        <button
          onClick={handleDismiss}
          className="ml-auto shrink-0 p-1 rounded-md text-amber-500 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
          aria-label="Dismiss notification"
        >
          <XIcon size={16} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
