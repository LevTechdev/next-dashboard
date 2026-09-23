"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * The marketing pages' Lenis instance, kept for imperative scrolling
 * (in-page anchors, the hero scroll cue). Only one instance exists at a time
 * because SmoothScroll mounts once per marketing layout.
 */
let activeLenis: Lenis | null = null;

/** The marketing header is fixed; mirror the native 6rem scroll-padding. */
function getHeaderOffset(): number {
  const header = document.querySelector<HTMLElement>("header");
  const headerHeight = header ? header.offsetHeight : 0;
  return Math.max(headerHeight, 64) + 24;
}

function findHashTarget(hash: string): HTMLElement | null {
  const rawId = hash.slice(1);
  if (!rawId) return null;
  let id: string;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    id = rawId;
  }
  return document.getElementById(id);
}

/** Strip trailing slashes so "/en" and "/en/" compare equal. */
function normalizePath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/**
 * Smoothly glide the window to an in-page target. Falls back to the native
 * `scrollIntoView` when Lenis is not running (e.g. reduced motion).
 */
function glideTo(target: HTMLElement, hash?: string) {
  if (activeLenis) {
    activeLenis.scrollTo(target, {
      offset: -getHeaderOffset(),
      duration: 1.15,
    });
  } else {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (hash && typeof history !== "undefined" && history.pushState) {
    history.pushState(null, "", hash);
  }
}

/**
 * Wraps the marketing pages in Lenis buttery-smooth scrolling
 * (https://lenis.darkroom.engineering) and keeps GSAP ScrollTrigger in sync
 * by driving both from the same GSAP ticker.
 *
 * In-page anchor links (`#section`, or `/en/#section` while already on the
 * page) are intercepted and glided with Lenis — including the header offset —
 * instead of the browser's instant jump. Clicks with modifiers, external
 * targets, or non-navigation anchors are left untouched.
 *
 * Respects `prefers-reduced-motion` — Lenis is not initialized then, so the
 * browser's native scrolling (with CSS `scroll-behavior: smooth`) takes over.
 */
export default function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
      // Keep native momentum/keyboard behaviour for trackpads & touch.
      syncTouch: false,
    });
    activeLenis = lenis;

    // Let ScrollTrigger know every time Lenis moves the page…
    lenis.on("scroll", ScrollTrigger.update);

    // …and drive Lenis from GSAP's ticker so everything stays in one loop.
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // ── In-page anchor delegation ────────────────────────────────────────
    const onAnchorClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank") return;

      const href = link.getAttribute("href") || "";
      const hashIndex = href.indexOf("#");
      if (hashIndex === -1) return;
      const hash = href.slice(hashIndex);
      if (!hash || hash === "#") return; // leave "#"-placeholders alone

      const rawPath = href.slice(0, hashIndex);
      const currentPath = window.location.pathname;
      const samePage = rawPath === "" || normalizePath(rawPath) === normalizePath(currentPath);
      if (!samePage) return; // cross-page navigation: let Next handle it

      const el = findHashTarget(hash);
      if (!el) return; // no matching section — native behaviour (no-op)

      event.preventDefault();
      glideTo(el, hash);
    };
    document.addEventListener("click", onAnchorClick);

    // Deep links that arrive with a hash (initial load / client nav): glide
    // after the first layout settles instead of the instant browser jump.
    const settle = () => {
      if (window.location.hash) {
        const el = findHashTarget(window.location.hash);
        if (el) glideTo(el);
      }
    };
    const rafId = requestAnimationFrame(() => requestAnimationFrame(settle));

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("click", onAnchorClick);
      gsap.ticker.remove(tick);
      lenis.destroy();
      if (activeLenis === lenis) activeLenis = null;
    };
  }, []);

  return <>{children}</>;
}
