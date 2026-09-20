"use client";

import { useCallback } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { loadAppearance, type ThemeSwitchKey } from "@/hooks/use-appearance";

/**
 * Theme switches that reveal instead of blink.
 *
 * Toggling light/dark used to swap every colour token at once — the page
 * "blinked" and you lost the sense of where the switch came from. This drives
 * the change through the View Transitions API instead: the outgoing theme is
 * held still underneath while the incoming one wipes in from the control the
 * user actually pressed, matching the skiper26 reference (clip-path circle /
 * rectangle / polygon, optional blur) that the switch UI was reskinned from.
 *
 * Contract:
 *  - The variant comes from Settings → Appearance (`themeSwitch`), read at
 *    click time so changing the preference applies to the very next switch.
 *  - `document.documentElement` carries `data-theme-reveal="<variant>"` only
 *    while the transition runs; globals.css keys every `::view-transition-*`
 *    rule off that attribute, so ordinary navigation transitions (page-content
 *    / nav-logo) and the browser default are untouched.
 *  - Geometry is handed to CSS through custom properties, so no keyframes are
 *    injected at runtime and nothing can diverge between server and client.
 *  - Falls back to a plain `setTheme` when the API is missing or the user asks
 *    for reduced motion — the switch still works, it just does not animate.
 */

/** Where the reveal grows from. */
export type ThemeRevealOrigin =
  { x: number; y: number } | Element | MouseEvent | "center" | null | undefined;

export interface ThemeRevealOptions {
  origin?: ThemeRevealOrigin;
  /** Override the saved preference (used by previews/tests). */
  variant?: ThemeSwitchKey;
}

/** Attribute set on <html> while a reveal is in flight (see globals.css). */
export const THEME_REVEAL_ATTRIBUTE = "data-theme-reveal";

const X_VAR = "--theme-reveal-x";
const Y_VAR = "--theme-reveal-y";
const RECT_VAR = "--theme-reveal-rect";
const POLY_VAR = "--theme-reveal-polygon";

/**
 * Token of the newest reveal. `startViewTransition` aborts whatever transition
 * is already running (and rejects its `finished` promise), so the stale
 * transition's cleanup must not strip the attribute out from under a newer one.
 */
let activeReveal = 0;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function viewTransition(): typeof document.startViewTransition | undefined {
  if (typeof document === "undefined") return undefined;
  const start = document.startViewTransition;
  return typeof start === "function" ? start.bind(document) : undefined;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Resolve any accepted origin form to viewport coordinates. */
function pointOf(origin: ThemeRevealOrigin): { x: number; y: number } {
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;
  const fallback = { x: width / 2, y: height / 2 };

  if (origin == null || origin === "center") return fallback;
  if (origin instanceof Element) {
    const rect = origin.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  if (typeof MouseEvent !== "undefined" && origin instanceof MouseEvent) {
    // Keyboard activation reports 0/0 — treat it as "no pointer".
    return origin.clientX || origin.clientY ? { x: origin.clientX, y: origin.clientY } : fallback;
  }
  if (typeof origin === "object" && "x" in origin && "y" in origin) {
    return { x: origin.x, y: origin.y };
  }
  return fallback;
}

/**
 * Origin for a React click handler: the pointer for mouse/touch activation,
 * the target's centre when the click came from the keyboard.
 */
export function themeRevealOriginFromEvent(event: {
  clientX: number;
  clientY: number;
  detail: number;
  currentTarget: EventTarget | null;
}): ThemeRevealOrigin {
  if (event.detail > 0 && (event.clientX || event.clientY)) {
    return { x: event.clientX, y: event.clientY };
  }
  if (event.currentTarget instanceof Element) return event.currentTarget;
  return "center";
}

function writeGeometry(root: HTMLElement, x: number, y: number) {
  const width = root.clientWidth || window.innerWidth || 1;
  const height = root.clientHeight || window.innerHeight || 1;
  const xPct = clamp01(x / width) * 100;
  const yPct = clamp01(y / height) * 100;

  root.style.setProperty(X_VAR, `${xPct.toFixed(3)}%`);
  root.style.setProperty(Y_VAR, `${yPct.toFixed(3)}%`);
  // inset(top right bottom left) — a shutter that closes down onto the origin.
  root.style.setProperty(
    RECT_VAR,
    `${yPct.toFixed(3)}% ${(100 - xPct).toFixed(3)}% ${(100 - yPct).toFixed(3)}% ${xPct.toFixed(3)}%`,
  );

  // The polygon keyframe interpolates to `polygon(0 0, 100% 0, 100% 100%, 0
  // 100%, 0 0)` — five points — so the start shape needs five too. A few
  // percent of slack keeps the shape non-degenerate (a zero-area polygon has
  // no direction to interpolate along in some engines).
  const d = 3;
  root.style.setProperty(
    POLY_VAR,
    [
      `${(xPct - d).toFixed(3)}% ${(yPct - d).toFixed(3)}%`,
      `${(xPct + d).toFixed(3)}% ${(yPct - d).toFixed(3)}%`,
      `${(xPct + d).toFixed(3)}% ${(yPct + d).toFixed(3)}%`,
      `${(xPct - d).toFixed(3)}% ${(yPct + d).toFixed(3)}%`,
      `${xPct.toFixed(3)}% ${yPct.toFixed(3)}%`,
    ].join(", "),
  );
}

/**
 * Run `apply` (which performs the theme change) inside a view transition.
 * Exported for the command palette / settings surfaces that call setTheme
 * directly rather than through the button.
 */
export function runThemeReveal(apply: () => void, options: ThemeRevealOptions = {}) {
  const startViewTransition = viewTransition();
  const variant = options.variant ?? loadAppearance().themeSwitch;

  if (!startViewTransition || variant === "none" || prefersReducedMotion()) {
    apply();
    return;
  }

  const root = document.documentElement;
  const { x, y } = pointOf(options.origin);
  writeGeometry(root, x, y);
  root.setAttribute(THEME_REVEAL_ATTRIBUTE, variant);

  const token = ++activeReveal;
  const cleanup = () => {
    // A newer reveal already owns the attribute — leave it alone.
    if (token !== activeReveal) return;
    root.removeAttribute(THEME_REVEAL_ATTRIBUTE);
    for (const property of [X_VAR, Y_VAR, RECT_VAR, POLY_VAR]) {
      root.style.removeProperty(property);
    }
  };

  // The DOM mutation has to land inside the transition callback, and React
  // schedules it asynchronously — flushSync forces it so the browser captures
  // the NEW theme, not a half-updated frame.
  const transition = startViewTransition(() => {
    flushSync(apply);
  });

  transition.finished.then(cleanup, cleanup);
}

/**
 * Theme-switch helpers for toggle controls.
 *
 * `toggle` flips light↔dark (the icon-button case); `select` sets an explicit
 * theme (the light/dark/system switchers), both revealing from the control the
 * user pressed.
 */
export function useThemeReveal() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const select = useCallback(
    (next: string, options: ThemeRevealOptions = {}) => {
      runThemeReveal(() => setTheme(next), options);
    },
    [setTheme],
  );

  const toggle = useCallback(
    (options: ThemeRevealOptions = {}) => {
      const next = resolvedTheme === "dark" ? "light" : "dark";
      runThemeReveal(() => setTheme(next), options);
    },
    [setTheme, resolvedTheme],
  );

  return { theme, resolvedTheme, select, toggle };
}
