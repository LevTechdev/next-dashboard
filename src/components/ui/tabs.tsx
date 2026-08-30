"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { useScrollFocusedIntoView } from "@/hooks/use-scroll-focused-into-view";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const listRef = React.useRef<React.ElementRef<typeof TabsPrimitive.List>>(null);
  const [scrollState, setScrollState] = React.useState({ scrollable: false, progress: 0 });

  // Arrow-key roving focus (or click) can land on a tab outside the pill's
  // visible area — scroll it into view without moving the page.
  useScrollFocusedIntoView(listRef);

  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setScrollState({
        scrollable: el.scrollWidth > el.clientWidth + 1,
        progress: max > 0 ? el.scrollLeft / max : 0,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return (
    <TabsPrimitive.List
      ref={(node) => {
        listRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(
        "relative inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 p-1 text-gray-500 dark:text-gray-400",
        // Below md the tab labels + icons can overflow the viewport; make the
        // bar full-width, left-aligned and internally scrollable. From md up it
        // returns to a centered shrink-to-fit pill. Callers can override per
        // breakpoint (e.g. orders passes md:w-full md:justify-start to keep the
        // bar full-width on desktop too).
        "w-full md:w-auto justify-start md:justify-center overflow-x-auto",
        // No native scrollbar inside the menu (see .scrollbar-none in
        // globals.css: WebKit display:none, Firefox scrollbar-width:none);
        // scrolling still works via touch / trackpad / shift-wheel, and the
        // tiny progress line at the bottom edge tracks it.
        "scrollbar-none",
        className,
      )}
      {...props}
    >
      {props.children}
      {scrollState.scrollable && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-gray-200 dark:bg-gray-700"
        >
          <div
            className="h-full rounded-full bg-gray-500/80 dark:bg-gray-400/80"
            style={{ width: `${Math.max(scrollState.progress * 100, 10)}%` }}
          />
        </div>
      )}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 data-[state=active]:shadow-sm",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
