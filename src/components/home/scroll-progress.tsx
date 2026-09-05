"use client";

import { useEffect, useRef } from "react";

/**
 * Reading-progress bar pinned to the top of marketing pages. A 3px accent
 * gradient fill + glowing tip tracks page scroll, with a small percentage
 * readout that fades in once the visitor starts scrolling.
 *
 * Deliberately dependency-free: a passive scroll listener + a rAF throttle
 * write straight to `transform`/`left`, so it stays smooth while Lenis,
 * GSAP ScrollTrigger and the WebGL hero share the frame budget.
 *
 * Hidden entirely under `prefers-reduced-motion`.
 */
export default function ScrollProgress() {
  const fillRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const fill = fillRef.current;
    const tip = tipRef.current;
    const pct = pctRef.current;
    if (!fill || !tip || !pct) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;

      // transform/left only — no layout thrash, compositor-friendly.
      fill.style.transform = `scaleX(${progress})`;
      tip.style.left = `${progress * 100}%`;
      pct.textContent = `${Math.round(progress * 100)}%`;
      pct.classList.toggle("opacity-0", progress <= 0.002);
    };

    const schedule = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-[3px]">
      {/* Track */}
      <div className="absolute inset-0 bg-border/30" />
      {/* Accent gradient fill (follows Settings → Appearance custom color) */}
      <div ref={fillRef} className="absolute inset-0 origin-left scale-x-0 bg-accent-gradient" />
      {/* Glowing tip */}
      <div
        ref={tipRef}
        className="absolute -top-[3px] left-0 h-[9px] w-[9px] -translate-x-1/2 rounded-full"
        style={{
          background: "hsl(var(--primary))",
          boxShadow: "0 0 12px 2px hsl(var(--primary) / 0.55)",
        }}
      />
      {/* Percentage readout (right edge) */}
      <div className="absolute right-2 top-1">
        <span
          ref={pctRef}
          className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground opacity-0 backdrop-blur transition-opacity duration-200"
        >
          0%
        </span>
      </div>
    </div>
  );
}
