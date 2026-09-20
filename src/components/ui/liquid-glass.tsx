"use client";

/**
 * Liquid Glass component family — Apple-style refractive glass surfaces.
 *
 * Components:
 * - `GlassEffect` — Refractive glass panel (`.liquid-glass-surface`)
 * - `GlassDock` — Floating dock bar with scale-on-hover children
 * - `GlassButton` — Circular / pill glass action button
 * - `GlassFilter` — Inline SVG displacement-map filter (feTurbulence +
 *   feDisplacementMap) that browsers with SVG-filter support apply to
 *   `.liquid-glass-surface` for the characteristic refraction.
 *
 * The visual foundation lives in `globals.css` (`@keyframes moveBackground`
 * and `.liquid-glass-surface`); these components only compose markup and
 * inline SVG filters — no external dependencies.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── GlassFilter ─────────────────────────────────────────────────────── */

export interface GlassFilterProps extends React.SVGAttributes<SVGSVGElement> {
  /** Unique filter id; also drives the `filter` CSS var on ancestors. */
  id: string;
  /** Displacement strength of the refraction. @default 12 */
  displacementScale?: number;
  /** Turbulence frequency (finer = more organic warping). @default 0.008 */
  baseFrequency?: number;
  /** Number of turbulence octaves. @default 2 */
  numOctaves?: number;
}

/**
 * Inline SVG filter used by `GlassEffect` to refract the backdrop. Render it
 * once per unique surface (or once app-wide with a shared id) — it renders
 * nothing visually.
 */
export const GlassFilter = React.forwardRef<SVGSVGElement, GlassFilterProps>(
  ({ id, displacementScale = 12, baseFrequency = 0.008, numOctaves = 2, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        aria-hidden="true"
        className="absolute h-0 w-0 opacity-0 pointer-events-none"
        {...props}
      >
        <filter id={id} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={baseFrequency}
            numOctaves={numOctaves}
            seed={7}
            result="turbulence"
          />
          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude="1" exponent="1" offset="0.5" />
            <feFuncG type="gamma" amplitude="0" exponent="1" offset="0.5" />
            <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
          </feComponentTransfer>
          <feGaussianBlur in="turbulence" stdDeviation="6" result="softMap" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softMap"
            scale={displacementScale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
    );
  },
);
GlassFilter.displayName = "GlassFilter";

/* ── GlassEffect ─────────────────────────────────────────────────────── */

export interface GlassEffectProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Displacement strength forwarded to a private filter instance. */
  displacementScale?: number;
  /** Backdrop blur radius in px. @default 8 */
  blur?: number;
  /** Glass tint; adjust for contrast over busy backgrounds. */
  tint?: string;
}

/**
 * Refractive liquid-glass panel. Renders a private `GlassFilter` plus a
 * surface div (`.liquid-glass-surface`) that consumes it via CSS variables.
 */
export const GlassEffect = React.forwardRef<HTMLDivElement, GlassEffectProps>(
  ({ className, children, displacementScale = 12, blur = 8, tint, style, ...props }, ref) => {
    const filterId = React.useId().replace(/[^a-zA-Z0-9]/g, "");
    return (
      <>
        <GlassFilter id={`glass-${filterId}`} displacementScale={displacementScale} />
        <div
          ref={ref}
          className={cn("liquid-glass-surface", className)}
          style={
            {
              "--glass-filter": `url(#glass-${filterId})`,
              "--glass-blur": `${blur}px`,
              ...(tint ? { "--glass-tint": tint } : {}),
              ...style,
            } as React.CSSProperties
          }
          {...props}
        >
          {children}
        </div>
      </>
    );
  },
);
GlassEffect.displayName = "GlassEffect";

/* ── GlassButton ─────────────────────────────────────────────────────── */

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Shape of the button. @default "circle" */
  shape?: "circle" | "pill";
  /** Visual intensity. @default "medium" */
  intensity?: "subtle" | "medium" | "strong";
}

/** Circular / pill glass action button, e.g. for docks and toolbars. */
export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, shape = "circle", intensity = "medium", style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "liquid-glass-surface relative inline-flex items-center justify-center",
          "text-gray-800 dark:text-gray-100 select-none cursor-pointer",
          "transition-all duration-200 active:scale-95",
          "focus-visible:outline-2 focus-visible:outline-primary",
          shape === "circle" ? "rounded-full h-12 w-12" : "rounded-full h-10 px-5",
          intensity === "subtle" && "opacity-80 hover:opacity-100",
          intensity === "strong" && "shadow-lg shadow-black/10",
          className,
        )}
        style={
          {
            "--glass-blur": "6px",
            ...style,
          } as React.CSSProperties
        }
        {...props}
      />
    );
  },
);
GlassButton.displayName = "GlassButton";

/* ── GlassDock ───────────────────────────────────────────────────────── */

export interface GlassDockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Magnification applied to hovered dock items (scale factor). @default 1.15 */
  magnification?: number;
}

/**
 * Floating glass dock bar. Direct children are dock items; hovering a child
 * scales it up (macOS-style magnification) via CSS on the dock.
 */
export const GlassDock = React.forwardRef<HTMLDivElement, GlassDockProps>(
  ({ className, children, magnification = 1.15, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "liquid-glass-surface inline-flex items-end gap-2 rounded-2xl px-3 py-2",
          "[&>*]:transition-transform [&>*]:duration-200 [&>*]:origin-bottom",
          "[&>*:hover]:scale-[var(--dock-magnification,1.15)]",
          className,
        )}
        style={
          {
            "--glass-blur": "10px",
            "--dock-magnification": magnification,
            ...style,
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
      </div>
    );
  },
);
GlassDock.displayName = "GlassDock";
