import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared form label with the app's standard styling: text-sm medium weight,
 * zinc-700 on light, zinc-300 on dark (the pattern the auth pages repeat
 * inline). Callers override the color — e.g. the auth pages' lime light-mode
 * accent — or add layout classes (block, mb-1.5) via className; cn/twMerge
 * resolves the conflicts in production.
 */
const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-sm font-medium text-zinc-700 dark:text-zinc-300", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export { Label };
