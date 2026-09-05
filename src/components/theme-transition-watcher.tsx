"use client";

import { useEffect, useRef } from "react";

/**
 * Watches for `.dark` class changes on `<html>` and briefly adds
 * `.theme-transitioning` so CSS transitions play smoothly during
 * user-initiated theme switches — without transitioning on initial load.
 *
 * Only an actual flip of the `dark` class triggers the cross-fade. Other
 * `<html>` class mutations (SmoothScroll adds/removes `lenis` classes right
 * after hydration, editors may add their own) are ignored: reacting to those
 * would pin the `html.theme-transitioning *` override — which forces a
 * color-only transition list on EVERY element with `!important` — over
 * layout tweens like the FAQ accordion's grid-template-rows for the
 * duration of the window.
 */
export function ThemeTransitionWatcher() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const html = document.documentElement;

    // Guard: our own classList.add/remove below also mutate the observed
    // `class` attribute, which would re-trigger this observer in an
    // infinite microtask loop and block the main thread before first paint.
    let suppress = false;

    // Baseline for flip detection, read once hydration has settled.
    let prevDark = html.classList.contains("dark");

    // Watch for future `.dark` class toggles on <html>.
    // Past mutations (SSR hydration class) are naturally ignored.
    const observer = new MutationObserver(() => {
      if (suppress) return;
      // Ignore class churn that doesn't flip the theme (e.g. SmoothScroll's
      // `lenis` classes) — see the doc comment above.
      const dark = html.classList.contains("dark");
      if (dark === prevDark) return;
      prevDark = dark;
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
