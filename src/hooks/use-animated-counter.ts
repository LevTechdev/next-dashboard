"use client";

import { useState, useEffect, useRef } from "react";

interface UseAnimatedCounterOptions {
  /** Duration of the count-up animation in ms (default: 1500) */
  duration?: number;
  /** Whether to start the animation immediately (default: true) */
  startOnMount?: boolean;
  /** Round the final value (default: true) */
  round?: boolean;
  /** Format function for the displayed value */
  formatFn?: (value: number) => string;
}

/**
 * Hook that animates a number counting up from 0 to the target value.
 * Uses requestAnimationFrame for smooth interpolation.
 */
export function useAnimatedCounter(
  end: number,
  options: UseAnimatedCounterOptions = {}
) {
  const { duration = 1500, startOnMount = true, round = true, formatFn } = options;
  const [value, setValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);

  const animate = () => {
    startValueRef.current = 0;
    startTimeRef.current = null;
    setIsAnimating(true);

    const step = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for a smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValueRef.current + (end - startValueRef.current) * eased;

      setValue(round ? Math.round(currentValue) : currentValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setValue(end);
        setIsAnimating(false);
      }
    };

    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (startOnMount) {
      animate();
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, duration, startOnMount]);

  const displayed = formatFn ? formatFn(value) : round ? Math.round(value).toString() : value.toFixed(1);

  return { value, displayed, isAnimating, restart: animate };
}
