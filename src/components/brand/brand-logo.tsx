import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Brand lockup used across the marketing header/footer and auth pages.
 *
 * A single identity everywhere: a dark foreground tile with the layout-grid
 * glyph and the "Dashboard" wordmark (the navbar look). Colors follow the CSS
 * variables, so the mark stays crisp on colored/hero surfaces and in both
 * themes, independent of the Settings → Appearance accent.
 *
 * Pass `animated` on hero/entry surfaces (auth pages) to turn on the gentle
 * logo life: a pulsing accent halo behind the tile, a slow float, and a soft
 * icon pulse. All keyframed motion respects `prefers-reduced-motion`.
 *
 * In dark mode the tile carries a subtle 1px accent ring (ring-primary), so
 * the brand mark stays visible against dark surfaces while the surrounding
 * glow/hover treatments breathe.
 */
const SIZE_STYLES = {
  sm: {
    tile: "h-8 w-8 rounded-lg",
    icon: "h-[18px] w-[18px]",
    wordmark: "text-[15px]",
  },
  md: {
    tile: "h-10 w-10 rounded-xl",
    icon: "h-5 w-5",
    wordmark: "text-xl",
  },
} as const;

export function BrandLogo({
  href,
  className,
  tileClassName,
  wordmarkClassName,
  iconClassName,
  hideWordmark = false,
  wordmark = "Dashboard",
  size = "md",
  animated = false,
  viewTransitionName,
}: {
  href?: string;
  className?: string;
  tileClassName?: string;
  wordmarkClassName?: string;
  iconClassName?: string;
  hideWordmark?: boolean;
  wordmark?: string;
  size?: keyof typeof SIZE_STYLES;
  animated?: boolean;
  /**
   * View Transition shared-element name (see TransitionLink): when set, the
   * anchor carries `data-view-transition-name` so the lockup morphs with its
   * counterpart (e.g. the sidebar logo) across page navigations.
   */
  viewTransitionName?: string;
}) {
  const s = SIZE_STYLES[size];
  const lockup = (
    <>
      <span
        className={cn("relative inline-flex items-center justify-center", animated && "shrink-0")}
      >
        {animated && (
          <span
            aria-hidden
            className="absolute inset-0 -m-1 rounded-full bg-primary/50 blur-md animate-[brand-logo-glow_3.2s_ease-in-out_infinite] motion-reduce:animate-none"
          />
        )}
        <span
          className={cn(
            "relative flex items-center justify-center bg-foreground text-background shadow-sm transition-all duration-300 dark:ring-1 dark:ring-primary/40",
            s.tile,
            tileClassName,
            animated &&
              "animate-[brand-logo-float_3.6s_ease-in-out_infinite] motion-reduce:animate-none",
          )}
        >
          <LayoutDashboard
            className={cn(
              s.icon,
              iconClassName,
              animated &&
                "animate-[brand-logo-icon_2.8s_ease-in-out_infinite] motion-reduce:animate-none",
            )}
            aria-hidden
          />
        </span>
      </span>
      {!hideWordmark && (
        <span
          className={cn(
            "font-semibold tracking-tight text-foreground",
            s.wordmark,
            wordmarkClassName,
          )}
        >
          {wordmark}
        </span>
      )}
    </>
  );

  const anchorProps = viewTransitionName ? { "data-view-transition-name": viewTransitionName } : {};
  if (href) {
    return (
      <Link
        href={href}
        className={cn("group inline-flex items-center gap-2.5", className)}
        {...anchorProps}
      >
        {lockup}
      </Link>
    );
  }
  return <div className={cn("inline-flex items-center gap-2.5", className)}>{lockup}</div>;
}
