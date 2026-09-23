"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

/**
 * Boardui-style light-surface tooltip (no-arrow variant).
 *
 * Matches the card/dropdown family: elevated surface, 1px border, lg radius,
 * dropdown shadow. Opens on hover AND focus, collision-flips to stay on
 * screen. The arrow/caret from the reference is deliberately omitted — the
 * caret reads as noise next to collapsed sidebar rails.
 *
 * Use `delay` to match the reference's instant feel (0) or the default
 * tooltip latency (300ms) in dense UIs.
 */

const TooltipProvider = TooltipPrimitive.Provider;
const TooltipRoot = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-[240px] select-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-md px-2.5 py-1.5 text-xs font-medium",
        "transition duration-200 ease-out",
        // Radix marks instant tooltips (delay 0) `instant-open`, delayed ones
        // `delayed-open` — animate both so delay=0 still gets the entrance.
        // slideDownFadeIn is direction-agnostic (pure scale+blur, no Y skew).
        "data-[state=delayed-open]:animate-slideDownFadeIn data-[state=instant-open]:animate-slideDownFadeIn",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/**
 * Convenience wrapper: trigger + content in one node.
 *
 * Self-providing — Radix's Root throws without a Provider ancestor, so the
 * wrapper mounts its own. Nesting Providers is harmless; app-level providers
 * just get shadowed for these subtrees.
 */
function Tooltip({
  children,
  content,
  side = "right",
  delay = 0,
  open,
  defaultOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delay?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <TooltipProvider delayDuration={delay}>
      <TooltipRoot
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
        delayDuration={delay}
      >
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{content}</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

export { Tooltip, TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent };
