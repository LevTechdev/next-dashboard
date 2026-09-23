"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { SunIcon, MoonIcon } from "lucide-animated";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { themeRevealOriginFromEvent, useThemeReveal } from "@/hooks/use-theme-reveal";

/**
 * The one light/dark button used by the marketing header and the auth pages.
 *
 * Before this existed, each surface hand-rolled its own button: three different
 * sizes, two different aria-labels, and none of them animated the switch. The
 * component owns the three behaviours that must not drift between surfaces —
 * the hydration-safe icon (next-themes only resolves after mount), the reveal
 * origin (the pointer, or the button's centre for keyboard activation), and the
 * localized label/tooltip.
 */
export function ThemeToggleButton({
  className,
  activeClassName,
  iconClassName,
  side = "bottom",
  label,
  disabled,
}: {
  className?: string;
  /** Extra classes for the dark-state icon (e.g. a warmer sun colour). */
  activeClassName?: string;
  iconClassName?: string;
  side?: "top" | "bottom" | "left" | "right";
  label?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("common");
  const { resolvedTheme } = useTheme();
  const { toggle } = useThemeReveal();
  const [mounted, setMounted] = useState(false);

  // Intentional one-time mount guard to avoid hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Rendering the icon before mount would mismatch the server HTML, so the
  // moon (the default theme's icon) stands in for the first paint.
  const isDark = mounted && resolvedTheme === "dark";
  const text = label ?? t("toggleTheme");

  return (
    <Tooltip side={side} content={text}>
      <button
        type="button"
        disabled={disabled}
        aria-label={text}
        onClick={(event) => toggle({ origin: themeRevealOriginFromEvent(event) })}
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-muted-foreground transition-colors",
          "hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
          "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
      >
        {isDark ? (
          <SunIcon size={16} className={cn("h-4 w-4", iconClassName, activeClassName)} />
        ) : (
          <MoonIcon size={16} className={cn("h-4 w-4", iconClassName)} />
        )}
      </button>
    </Tooltip>
  );
}
