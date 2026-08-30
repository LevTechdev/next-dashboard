"use client";

import { memo, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FlipRevealTextProps {
  /** Words cycled through the 3D flip carousel */
  words: string[];
  /** Time each word stays on screen (ms) */
  interval?: number;
  /** Classes for the outer container */
  className?: string;
  /** Classes applied to the word itself (gradient/bg-clip-text safe) */
  textClassName?: string;
  /** Flip animation duration (s) */
  duration?: number;
}

/**
 * FlipRevealText — split-flap style, word-level 3D flip.
 *
 * Unlike FlipFadeText (per-letter animation), the whole word animates as a
 * single element, so `bg-clip-text` gradients paint correctly in both light
 * and dark mode — the background and the text live on the same paint layer.
 */
const WordFace = memo(function WordFace({
  text,
  textClassName,
  duration,
}: {
  text: string;
  textClassName?: string;
  duration: number;
}) {
  return (
    <motion.span
      initial={{ rotateX: 90, y: "0.35em", opacity: 0, filter: "blur(6px)" }}
      animate={{ rotateX: 0, y: 0, opacity: 1, filter: "blur(0px)" }}
      exit={{ rotateX: -90, y: "-0.35em", opacity: 0, filter: "blur(6px)" }}
      transition={{ duration, ease: [0.2, 0.65, 0.3, 0.9] }}
      style={{
        transformStyle: "preserve-3d",
        backfaceVisibility: "hidden",
        transformOrigin: "50% 50%",
      }}
      className={cn("inline-block whitespace-nowrap will-change-transform", textClassName)}
    >
      {text}
    </motion.span>
  );
});

export function FlipRevealText({
  words,
  interval = 2800,
  className,
  textClassName,
  duration = 0.55,
}: FlipRevealTextProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, interval);
    return () => clearInterval(id);
  }, [interval, words.length]);

  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      style={{ perspective: "900px" }}
    >
      <AnimatePresence mode="wait">
        <WordFace
          key={words[index]}
          text={words[index]}
          textClassName={textClassName}
          duration={duration}
        />
      </AnimatePresence>
    </span>
  );
}
