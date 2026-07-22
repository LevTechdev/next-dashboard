"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

interface PageProgressBarProps {
  /** Duration of the indeterminate animation in ms before completing. Default 600. */
  duration?: number;
}

/**
 * A thin indeterminate progress bar that appears at the top of the viewport
 * during page transitions, similar to YouTube's red loading bar.
 *
 * Detects route changes automatically via usePathname. The bar sweeps a
 * gradient from left to right while navigating and fades out on completion.
 */
export default function PageProgressBar({
  duration = 600,
}: PageProgressBarProps) {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [completing, setCompleting] = useState(false);
  const prevPathname = useRef(pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      if (timerRef.current) clearTimeout(timerRef.current);
      setCompleting(false);
      setShow(true);

      // After the indeterminate period, snap to 100% and fade out
      timerRef.current = setTimeout(() => {
        setCompleting(true);
        // Allow the completion animation to play, then hide
        timerRef.current = setTimeout(() => {
          setShow(false);
          setCompleting(false);
          timerRef.current = null;
        }, 300);
      }, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, duration]);

  if (!show) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] overflow-hidden"
      role="progressbar"
      aria-label="Page loading"
      aria-valuenow={completing ? 100 : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Indeterminate sweeping gradient bar */}
      <div
        className={`absolute inset-0 transition-all duration-300 ease-in-out ${
          completing
            ? "w-full opacity-0"
            : "w-[80%] opacity-100 animate-progress-sweep motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:w-[60%]"
        }`}
      >
        <div className="h-full w-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent dark:via-indigo-400" />
      </div>
    </div>
  );
}
