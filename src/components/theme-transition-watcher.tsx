"use client";

import { useEffect, useRef } from "react";

/**
 * Watches for `.dark` class changes on `<html>` and briefly adds
 * `.theme-transitioning` so CSS transitions play smoothly during
 * user-initiated theme switches — without transitioning on initial load.
 */
export function ThemeTransitionWatcher() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const html = document.documentElement;

    // Guard: our own classList.add/remove below also mutate the observed
    // `class` attribute, which would re-trigger this observer in an
    // infinite microtask loop and block the main thread before first paint.
    let suppress = false;

    // Watch for future `.dark` class toggles on <html>.
    // Past mutations (SSR hydration class) are naturally ignored.
    const observer = new MutationObserver(() => {
      if (suppress) return;
      suppress = true;
      html.classList.add("theme-transitioning");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        html.classList.remove("theme-transitioning");
        // Let the removal's mutation record flush while still suppressed,
        // then re-arm the observer for the next real theme toggle.
        setTimeout(() => {
          suppress = false;
        }, 0);
      }, 450);
    });

    observer.observe(html, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      observer.disconnect();
    };
  }, []);

  return null;
}
