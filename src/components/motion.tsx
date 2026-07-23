"use client";

import { motion, type Variants, type HTMLMotionProps } from "framer-motion";
import { forwardRef, type ReactNode } from "react";

// ── Animation Variants ──

export const fadeIn: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
  },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay: i * 0.1,
      ease: [0.25, 0.1, 0.25, 1],
    },
  }),
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.02,
    y: -4,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

export const buttonTap = { scale: 0.97 };

// ── Reusable Components ──

interface AnimateSectionProps extends HTMLMotionProps<"section"> {
  children: ReactNode;
  className?: string;
}

/**
 * A section wrapper that animates its children when scrolled into view.
 */
export function AnimateSection({ children, className, ...props }: AnimateSectionProps) {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={fadeIn}
      className={className}
      {...props}
    >
      {children}
    </motion.section>
  );
}

interface AnimateDivProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "span" | "p";
  delay?: number;
}

/**
 * A simple div wrapper that fades up when scrolled into view.
 * @param delay - Optional stagger delay (multiplied by 0.1s)
 */
export function AnimateUp({ children, className, as = "div", delay = 0 }: AnimateDivProps) {
  const Component = as === "li" ? motion.li : motion.div;
  return (
    <Component
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.5,
            delay: delay * 0.1,
            ease: [0.25, 0.1, 0.25, 1],
          },
        },
      }}
      className={className}
    >
      {children}
    </Component>
  );
}

/**
 * A staggered grid container — children animate in sequentially.
 */
export const StaggerGrid = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(
  ({ children, className }, ref) => (
    <motion.div
      ref={ref}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  ),
);
StaggerGrid.displayName = "StaggerGrid";

/**
 * A child of StaggerGrid — animates with fade-in-up on staggered delay.
 */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * A hover-lift card wrapper — adds subtle lift + shadow on hover.
 */
export function HoverCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="rest"
      whileHover="hover"
      variants={{
        rest: { y: 0, boxShadow: "0 0 0 rgba(0,0,0,0)" },
        hover: {
          y: -6,
          boxShadow: "0 12px 24px rgba(0,0,0,0.08)",
          transition: { duration: 0.25, ease: "easeOut" },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
