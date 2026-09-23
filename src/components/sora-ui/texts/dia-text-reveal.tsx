"use client";

/**
 * DiaTextReveal — a gradient sweep that reveals a headline with a chromatic wash.
 *
 * Two stacked copies of the phrase do the work: a chromatic gradient copy
 * underneath, and the ink copy (your page's text colour) on top, revealed by an
 * animated `clip-path` inset. Sweeping the inset left-to-right paints the real
 * colour across the gradient — the "dia" wash. Pass an array of phrases with
 * `repeat` to cycle them: each phrase sweeps in, holds, the whole line fades,
 * and the next phrase sweeps in behind it.
 *
 * Details that matter in production:
 *   • The readable text is ALWAYS in the DOM (stacked copies, decorative one
 *     `aria-hidden`), so screen readers, search crawlers and E2E text
 *     assertions all see the current phrase.
 *   • `prefers-reduced-motion: reduce` skips the sweep, the fade and phrase
 *     cycling: the first phrase renders fully inked, no animation runs.
 *   • `fixedWidth` reserves the widest phrase's width, so cycling phrases never
 *     reflow the line they sit in.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ElementType,
} from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.23, 1, 0.32, 1] as const;

const DEFAULT_COLORS = ["#f0abfc", "#f472b6", "#fb923c", "#facc15", "#a3e635"];

export interface DiaTextRevealHandle {
  /** Start (or restart) the sweep from the beginning. */
  play: () => void;
  /** Alias of `play`, kept for API parity with the registry reference. */
  replay: () => void;
}

export interface DiaTextRevealProps {
  /** A phrase, or — with `repeat` — a list of phrases to cycle. */
  text: string | string[];
  colors?: string[];
  duration?: number;
  delay?: number;
  direction?: "ltr" | "rtl";
  textColor?: string;
  as?: ElementType;
  onComplete?: () => void;
  /** Cycle through `text` phrases. Requires an array to be useful. */
  repeat?: boolean;
  repeatDelay?: number;
  holdDuration?: number;
  fadeDuration?: number;
  /** Reserve the widest phrase's width so cycling never reflows the line. */
  fixedWidth?: boolean;
  /** Wait until the element scrolls into view before playing. */
  startOnView?: boolean;
  once?: boolean;
  inViewMargin?: string;
  className?: string;
}

const wait = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

export const DiaTextReveal = forwardRef<DiaTextRevealHandle, DiaTextRevealProps>(
  function DiaTextReveal(
    {
      text,
      colors = DEFAULT_COLORS,
      duration = 1.5,
      delay = 0,
      direction = "ltr",
      textColor = "currentColor",
      as: Comp = "span",
      onComplete,
      repeat = false,
      repeatDelay = 0.5,
      holdDuration = 1,
      fadeDuration = 0.6,
      fixedWidth = false,
      startOnView = true,
      once = true,
      inViewMargin = "0px",
      className,
    },
    ref,
  ) {
    const phrases = Array.isArray(text) ? text : [text];
    const reduce = useReducedMotion();
    const [index, setIndex] = useState(0);
    const containerRef = useRef<HTMLElement | null>(null);
    const inView = useInView(containerRef, { once, margin: inViewMargin as never });
    const started = useRef(false);
    const runId = useRef(0);

    // sweep: 0 = fully chromatic, 1 = fully inked. Opacity drives the phrase
    // crossfade; both live outside React state so the animation never re-renders.
    const sweep = useMotionValue(reduce ? 1 : 0);
    const opacityMv = useMotionValue(1);

    const clip = useTransform(sweep, (s) => {
      const hidden = Math.max(0, Math.min(1, 1 - s)) * 100;
      return direction === "rtl" ? `inset(0 0 0 ${hidden}%)` : `inset(0 ${hidden}% 0 0)`;
    });

    const gradient = `linear-gradient(90deg, ${colors.join(", ")})`;

    const play = useCallback(async () => {
      const id = ++runId.current;
      const alive = () => id === runId.current;

      // Reduced motion: no sweep, no fade, no cycling — just the inked phrase.
      if (reduce) {
        sweep.jump(1);
        opacityMv.jump(1);
        return;
      }

      setIndex(0);
      sweep.jump(0);
      opacityMv.jump(1);

      for (;;) {
        await animate(sweep, 1, { duration, delay, ease: EASE }).finished;
        if (!alive()) return;
        onComplete?.();

        if (!repeat || phrases.length < 2) return;

        await wait(holdDuration);
        if (!alive()) return;

        await animate(opacityMv, 0, { duration: fadeDuration, ease: "easeInOut" }).finished;
        if (!alive()) return;

        setIndex((i) => (i + 1) % phrases.length);
        sweep.jump(0);

        await wait(repeatDelay);
        if (!alive()) return;

        await animate(opacityMv, 1, { duration: fadeDuration, ease: "easeInOut" }).finished;
        if (!alive()) return;
      }
    }, [
      reduce,
      delay,
      duration,
      repeat,
      phrases.length,
      holdDuration,
      fadeDuration,
      repeatDelay,
      onComplete,
      sweep,
      opacityMv,
    ]);

    useImperativeHandle(ref, () => ({ play: () => void play(), replay: () => void play() }), [
      play,
    ]);

    useEffect(() => {
      if (started.current) return;
      if (startOnView && !inView) return;
      started.current = true;
      void play();
      return () => {
        // Cancel any in-flight loop when this instance goes away.
        runId.current += 1;
      };
    }, [inView, startOnView, play]);

    const phrase = phrases[index] ?? phrases[0] ?? "";
    const longest = phrases.reduce((a, b) => (b.length > a.length ? b : a), "");

    return (
      <Comp
        ref={containerRef}
        // The stacking classes go LAST so a caller's display utility (e.g.
        // `inline-flex`) can never clobber `inline-grid` — with the copies
        // laid out in different cells they read as duplicated, overlapping
        // text instead of one line.
        className={cn(
          className,
          "relative inline-grid items-baseline [&>*]:col-start-1 [&>*]:row-start-1",
        )}
      >
        {/* Chromatic underlay — decorative, so it stays out of the a11y tree. */}
        <motion.span
          aria-hidden="true"
          className="whitespace-pre"
          style={{
            opacity: reduce ? 0 : opacityMv,
            backgroundImage: gradient,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {phrase}
        </motion.span>

        {/* Ink copy: the accessible text, painted on by the sweep. */}
        <motion.span
          className="whitespace-pre"
          style={{
            clipPath: reduce ? undefined : clip,
            opacity: reduce ? 1 : opacityMv,
            color: textColor,
          }}
        >
          {phrase}
        </motion.span>

        {/* Width reservation for cycling phrases. */}
        {fixedWidth && (
          <span aria-hidden="true" className="invisible whitespace-pre">
            {longest}
          </span>
        )}
      </Comp>
    );
  },
);
