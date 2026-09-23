"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

/**
 * Word-by-word staggered rise + de-blur for hero headings.
 *
 * This is the about-page hero treatment (each word rises out of an
 * overflow-hidden slot while its blur resolves), extracted so the rest of the
 * marketing surface shares one choreography instead of fading its <h1> in as a
 * single flat block. Screen readers get the plain string through aria-label
 * while the animated spans stay aria-hidden.
 */
export function AnimatedHeading({
  text,
  className,
  wordClassName,
  delay = 0,
  stagger = 0.07,
}: {
  text: string;
  className?: string;
  /** Extra classes for each animated word slot. */
  wordClassName?: string;
  /** Delay before the first word starts, in seconds. */
  delay?: number;
  /** Per-word stagger, in seconds. */
  stagger?: number;
}) {
  const words = text.split(" ");
  return (
    <span className={cn("inline-block", className)} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          aria-hidden
          className={cn("inline-block overflow-hidden pb-1 -mb-1 align-bottom", wordClassName)}
        >
          <motion.span
            className="inline-block will-change-transform"
            initial={{ opacity: 0, y: "0.9em", filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.55, delay: delay + i * stagger, ease: easeSmooth }}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/**
 * Subtitle counterpart: the same blur-resolution used directly under the about
 * hero, for the paragraph that follows an AnimatedHeading.
 */
export function AnimatedSubtitle({
  text,
  className,
  delay = 0.45,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.span
      className={cn("inline-block", className)}
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.7, delay, ease: easeSmooth }}
    >
      {text}
    </motion.span>
  );
}
