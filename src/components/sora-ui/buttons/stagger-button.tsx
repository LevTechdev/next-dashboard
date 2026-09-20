"use client";

/**
 * StaggerButton — a link/button whose label staggers in per character on hover.
 *
 * The interaction is pure CSS: the resting label fades out while the animating
 * copy rises in character-by-character (each character carries its own
 * transition delay, so the row reads as a wave). Nothing depends on JS at
 * animation time, which keeps the navbar cheap and means the label is always
 * present in the DOM for screen readers, crawlers and E2E text assertions.
 *
 * `stagger="text"` slides the whole label instead of splitting it — the right
 * choice for longer copy or labels that must not be split mid-word.
 *
 * Accessibility: the resting copy carries the accessible text; the animating
 * copy is `aria-hidden`. Under `prefers-reduced-motion` the transitions are
 * disabled, so the label simply stays put.
 */

import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Anchor attributes (with `href` optional) — this is primarily a link. */
export interface StaggerButtonProps extends Omit<ComponentPropsWithoutRef<"a">, "href"> {
  /** Renders a next/link instead of a button when set. */
  href?: string;
  /** Radix Slot mode: merge onto the single child element (no stagger markup). */
  asChild?: boolean;
  /** Explicit label; falls back to a plain-string child. */
  label?: string;
  children?: ReactNode;
  stagger?: "char" | "text";
  /** Per-character delay, in seconds. */
  staggerDelay?: number;
  className?: string;
  /** Extra classes for the animating characters only. */
  charClassName?: string;
  /** Button-mode only. */
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

export function StaggerButton({
  href,
  asChild = false,
  label,
  children,
  stagger = "char",
  staggerDelay = 0.01,
  className,
  charClassName,
  ...props
}: StaggerButtonProps) {
  const text = label ?? (typeof children === "string" ? children : "");
  const plain = asChild || !text;

  const classes = cn(
    "group/stagger relative inline-flex",
    !plain && "items-center justify-center overflow-hidden",
    className,
  );

  const content = plain ? (
    children
  ) : (
    <>
      {/* Resting label: the accessible copy (fades out on hover). */}
      <span className="transition-opacity duration-200 ease-out group-hover/stagger:opacity-0 motion-reduce:transition-none motion-reduce:group-hover/stagger:opacity-100">
        {text}
      </span>

      {/* Animating copy: decorative, hidden from assistive tech. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        {stagger === "char" ? (
          text.split("").map((char, i) => (
            <span
              key={`${char}-${i}`}
              style={{ transitionDelay: `${i * staggerDelay}s` }}
              className={cn(
                "inline-block translate-y-[110%] opacity-0 transition-all duration-300 ease-out",
                "group-hover/stagger:translate-y-0 group-hover/stagger:opacity-100",
                "motion-reduce:translate-y-0 motion-reduce:transition-none",
                charClassName,
              )}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          ))
        ) : (
          <span
            className={cn(
              "inline-block translate-y-[110%] opacity-0 transition-all duration-300 ease-out",
              "group-hover/stagger:translate-y-0 group-hover/stagger:opacity-100",
              "motion-reduce:translate-y-0 motion-reduce:transition-none",
              charClassName,
            )}
          >
            {text}
          </span>
        )}
      </span>
    </>
  );

  // Three separately-typed branches: Slot, next/link and a real <button> have
  // mutually incompatible prop element types, and a merged spread would only
  // satisfy any of them by accident.
  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {content}
      </Slot>
    );
  }

  if (href) {
    return (
      <Link href={href} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  const buttonProps = props as unknown as ComponentPropsWithoutRef<"button">;
  return (
    <button type={props.type ?? "button"} className={classes} {...buttonProps}>
      {content}
    </button>
  );
}
