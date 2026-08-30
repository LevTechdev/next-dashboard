"use client";

import { useEffect, useRef, type RefObject } from "react";

const DEFAULT_OPTIONS: ScrollIntoViewOptions = {
  block: "nearest",
  inline: "nearest",
  behavior: "smooth",
};

/**
 * Scrolls an element into view when it gains focus inside a scrollable
 * container — e.g. keyboard roving focus or Tab reaching an item clipped by
 * an overflow-x row (tab bars, filter-pill strips). `block: "nearest"` keeps
 * the page from jumping vertically; `inline: "nearest"` scrolls the row just
 * enough to reveal the focused item. Focus landing on the container itself is
 * ignored, and it's a no-op when the row doesn't overflow.
 *
 * @param ref      Ref to the scrollable container to observe.
 * @param options  scrollIntoView options (defaults to nearest/nearest/smooth).
 */
export function useScrollFocusedIntoView<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: ScrollIntoViewOptions = DEFAULT_OPTIONS,
) {
  // Keep options fresh without re-installing the listener on every render
  // (a new object literal would otherwise churn the effect).
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target !== container &&
        container.contains(target) &&
        typeof target.scrollIntoView === "function"
      ) {
        target.scrollIntoView(optionsRef.current);
      }
    };

    container.addEventListener("focusin", handleFocusIn);
    return () => container.removeEventListener("focusin", handleFocusIn);
  }, [ref]);
}
