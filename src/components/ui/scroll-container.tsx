import * as React from "react";
import { cn } from "@/lib/utils";

export interface ScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Which axis can scroll. Defaults to vertical. */
  axis?: "y" | "x" | "both";
}

/**
 * A scrollable region that ships with the app's thin scrollbar by default
 * (the `.scrollbar-thin` utility in globals.css: a 4px WebKit bar +
 * `scrollbar-width: thin` for Firefox). Prefer this over a bare
 * `overflow-y-auto` div so new scroll containers never silently fall back to
 * the chunky default scrollbar.
 *
 * The wrapper renders `overflow-*-auto` + `scrollbar-thin` and merges any
 * caller classes through cn/twMerge, so callers can still override the axis
 * or add layout classes (e.g. `flex-1`, `max-h-[400px]`). Refs, onScroll and
 * aria-* props pass through to the underlying `<div>`.
 */
const ScrollContainer = React.forwardRef<HTMLDivElement, ScrollContainerProps>(
  ({ axis = "y", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        axis === "y" ? "overflow-y-auto" : axis === "x" ? "overflow-x-auto" : "overflow-auto",
        "scrollbar-thin",
        className,
      )}
      {...props}
    />
  ),
);
ScrollContainer.displayName = "ScrollContainer";

export { ScrollContainer };
