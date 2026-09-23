"use client";

/**
 * StackingCards — a vertical scroll layout where cards pin and layer.
 *
 * Each card is `position: sticky` inside a tall wrapper; as the next card
 * scrolls in it covers the previous one, which scales down and dims slightly so
 * the stack reads as depth rather than overlap. A single `useScroll` on the
 * container drives every card's window, so the sequence stays perfectly in
 * sync regardless of how many cards are passed.
 *
 * Details worth knowing:
 *   • The LAST card never scales or fades out — it stays as the resting state of
 *     the section instead of dissolving exactly when the reader arrives.
 *   • `MotionConfig reducedMotion="user"` keeps the layout intact while dropping
 *     the scale/dim choreography for `prefers-reduced-motion` users.
 *   • Cards remain ordinary DOM in document order, so the content is fully
 *     readable (and indexable) without any JS.
 */

import { Children, useRef, type ReactNode } from "react";
import { MotionConfig, motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

export interface StackingCardsProps {
  children: ReactNode;
  className?: string;
  /** Sticky offset for the first card, in px (leave room for the fixed header). */
  stickyTop?: number;
  /** Extra offset per stacked card, in px — controls how much of each card peeks. */
  offsetStep?: number;
  /** Height of each card's scroll slot (Tailwind height class). */
  cardSlotClassName?: string;
}

function StackingCard({
  progress,
  index,
  total,
  stickyTop,
  offsetStep,
  cardSlotClassName,
  children,
}: {
  progress: MotionValue<number>;
  index: number;
  total: number;
  stickyTop: number;
  offsetStep: number;
  cardSlotClassName: string;
  children: ReactNode;
}) {
  const isLast = index === total - 1;
  const start = index / total;
  const end = Math.min(1, (index + 1) / total);

  const scale = useTransform(progress, [start, end], [1, isLast ? 1 : 0.92]);
  const opacity = useTransform(progress, [start, end], [1, isLast ? 1 : 0.55]);
  const y = useTransform(progress, [start, end], [0, isLast ? 0 : -18]);

  return (
    <div className={cn("relative", cardSlotClassName)}>
      <motion.div
        style={{ scale, opacity, y, top: stickyTop + index * offsetStep }}
        className="sticky will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}

export function StackingCards({
  children,
  className,
  stickyTop = 104,
  offsetStep = 14,
  cardSlotClassName = "h-[min(78vh,540px)]",
}: StackingCardsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const items = Children.toArray(children);

  return (
    <MotionConfig reducedMotion="user">
      <div ref={ref} className={cn("relative", className)}>
        {items.map((child, index) => (
          <StackingCard
            // Position is the identity here: the cards are an ordered story.
            key={index}
            progress={scrollYProgress}
            index={index}
            total={items.length}
            stickyTop={stickyTop}
            offsetStep={offsetStep}
            cardSlotClassName={cardSlotClassName}
          >
            {child}
          </StackingCard>
        ))}
      </div>
    </MotionConfig>
  );
}
