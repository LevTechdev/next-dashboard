"use client";

import { useEffect } from "react";
import { applyAppearance, loadAppearance } from "@/hooks/use-appearance";

/**
 * Applies persisted appearance preferences (accent color, text size,
 * density) to <html> on first paint. Rendered once in the locale layout.
 */
export function AppearanceInit() {
  useEffect(() => {
    applyAppearance(loadAppearance());
  }, []);
  return null;
}
