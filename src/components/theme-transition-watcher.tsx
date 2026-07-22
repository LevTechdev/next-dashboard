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

    // Watch for future `.dark` class toggles on <html>.
    // Past mutations (SSR hydration class) are naturally ignored.
    const observer = new MutationObserver(() => {
      html.classList.add("theme-transitioning");
      timerRef.current = setTimeout(() => {
        html.classList.remove("theme-transitioning");
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
