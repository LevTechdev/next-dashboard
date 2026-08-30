"use client";

import { useId, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export interface AnimatedDisclosureProps {
  /** Whether the content region is expanded (controlled). */
  open: boolean;
  /** Called when the trigger button is clicked (or the parent toggles). */
  onToggle: () => void;
  /**
   * The trigger rendered inside the disclosure button. Pass a render-prop
   * function to react to the open state (e.g. rotate a chevron). Return null
   * to hide the button entirely while keeping the content region (e.g. a
   * dismissed hint that stays open).
   */
  trigger?: ReactNode | ((state: { open: boolean }) => ReactNode);
  /** Classes for the trigger button (only rendered when `trigger` is set). */
  triggerClassName?: string;
  /** Classes for the animated content wrapper (the height-tweened region). */
  contentClassName?: string;
  /** Explicit id for the content region (defaults to an auto-generated one). */
  contentId?: string;
  /**
   * Keep the content mounted at all times and animate with a CSS
   * grid-template-rows tween instead of mounting on open. The body stays in
   * the initial SSR HTML — important for SEO-sensitive surfaces like the
   * marketing FAQ — and collapsing clips it to zero height. Under reduced
   * motion the tween is disabled via the motion-reduce:transition-none
   * utility (pure CSS, no hydration concern).
   */
  keepMounted?: boolean;
  children: ReactNode;
}

/**
 * A disclosure (expand/collapse) with a smooth height tween.
 *
 * The trigger is a real <button> with aria-expanded/aria-controls pointing at
 * the content region, so the pattern is keyboard- and screen-reader-friendly.
 * By default the content is mounted only while open and animated with a
 * framer-motion height tween (good for dashboard surfaces where closed
 * regions shouldn't linger in the DOM). Pass keepMounted for surfaces that
 * must keep the body in the initial SSR HTML (SEO) — it uses a CSS
 * grid-template-rows tween instead, so no client-only mounting is needed.
 * When the user prefers reduced motion, the tween is skipped entirely and the
 * region snaps open/closed.
 *
 * Usage:
 *   <AnimatedDisclosure
 *     open={isOpen}
 *     onToggle={() => setIsOpen(!isOpen)}
 *     trigger={({ open }) => (
 *       <>
 *         <span>Why is this happening?</span>
 *         <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
 *       </>
 *     )}
 *   >
 *     <p>The explanation…</p>
 *   </AnimatedDisclosure>
 */
export function AnimatedDisclosure({
  open,
  onToggle,
  trigger,
  triggerClassName,
  contentClassName,
  contentId,
  keepMounted = false,
  children,
}: AnimatedDisclosureProps) {
  const generatedId = useId();
  const id = contentId ?? generatedId;
  const prefersReducedMotion = usePrefersReducedMotion();
  const resolvedTrigger = typeof trigger === "function" ? trigger({ open }) : trigger;

  return (
    <div>
      {resolvedTrigger != null && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className={triggerClassName}
        >
          {resolvedTrigger}
        </button>
      )}
      {keepMounted ? (
        // Always-mounted content: a CSS grid-template-rows tween clips the
        // body to zero height when closed while keeping it in the SSR HTML
        // (SEO). The transition utilities are overridable via contentClassName
        // (tailwind-merge: later classes win, e.g. transition-all for color
        // tweens alongside the height tween). motion-reduce:transition-none
        // snaps the tween for reduced-motion users via pure CSS.
        <div
          id={id}
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            contentClassName,
          )}
        >
          <div className="overflow-hidden">{children}</div>
        </div>
      ) : prefersReducedMotion ? (
        // Reduced motion: no height tween — the region mounts/unmounts
        // instantly (no AnimatePresence exit to wait through).
        open ? (
          <div
            id={id}
            data-reduced-motion="true"
            className={cn("overflow-hidden", contentClassName)}
          >
            {children}
          </div>
        ) : null
      ) : (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={id}
              key="animated-disclosure-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={cn("overflow-hidden", contentClassName)}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export default AnimatedDisclosure;
