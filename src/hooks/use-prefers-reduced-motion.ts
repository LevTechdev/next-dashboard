"use client";

import { useEffect, useState } from "react";

/**
 * Whether the user has requested reduced motion via the
 * `prefers-reduced-motion: reduce` media query.
 *
 * SSR-safe: matchMedia is only read inside an effect (after mount), so the
 * server render and the first client render both see `false` — no hydration
 * mismatch — and the real preference applies on the next render. The hook
 * also reacts to live OS/browser preference changes while mounted.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mediaQuery) return;

    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}
