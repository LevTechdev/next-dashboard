"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  ChevronRight,
  Monitor,
  Route,
  LayoutGrid,
  CircleDollarSign,
  Star,
  Globe,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DiaTextReveal } from "@/components/sora-ui/texts/dia-text-reveal";

interface HeroOverviewProps {
  locale: string;
  t: {
    (key: string): string;
    raw: (key: string) => unknown;
  };
  /** Set true once the cinematic preloader has finished so hero elements reveal progressively. */
  revealed?: boolean;
}

/** Progressive-reveal classes: hidden until `shown`, then slide + fade in.
 *  Also drops pointer events while hidden so invisible controls can't be clicked. */
function revealClass(shown: boolean) {
  return cn(
    "transition-all duration-700 ease-out will-change-transform motion-reduce:transition-none",
    shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7 pointer-events-none",
  );
}

/**
 * Control-Room Signal Hub
 * ————————————————————————————————————————————————
 * A compact, single-viewport landing hero that introduces the ENTIRE page
 * instead of competing with it.
 *
 *  • Calm editorial composition: theme-aware gradient mesh + faint blueprint
 *    grid + two floating signal chips — pure CSS, so first paint skips the
 *    THREE.js renderer, gsap ScrollTrigger, and hero video downloads entirely.
 *  • One memorable anchor: the Signal Strip, a hero-level table of contents
 *    that maps 1:1 to every section below (Preview → Journey → Features →
 *    Pricing). The labels use the dedicated hero.hub.* keys, so the TOC copy
 *    can never collide with (or drift from) the sections it indexes.
 *  • One entrance sequence (CSS reveal gated by the cinematic preloader's
 *    `revealed` flag) plus a handful of meaningful hovers. No micro-motion.
 */

const signalStripItems = [
  { href: "#preview", labelKey: "hero.hub.preview", icon: Monitor, accent: "text-sky-500" },
  { href: "#story", labelKey: "hero.hub.journey", icon: Route, accent: "text-emerald-500" },
  { href: "#features", labelKey: "hero.hub.features", icon: LayoutGrid, accent: "text-violet-500" },
  {
    href: "#pricing",
    labelKey: "hero.hub.pricing",
    icon: CircleDollarSign,
    accent: "text-amber-500",
  },
] as const;

export default function HeroOverview({ locale, t, revealed = true }: HeroOverviewProps) {
  // Theme is read (never toggled) here: the ambient gradient mesh below picks
  // the dark or light scene from the resolved theme. The day/night toggle that
  // used to live in the top bar was removed — the marketing header owns the
  // single global theme control.
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark");

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section
      aria-label={t("hero.ariaLabel")}
      className="relative min-h-screen w-full overflow-hidden flex flex-col text-foreground"
    >
      {/* ═══ Ambient backdrop: theme-aware gradient mesh + blueprint grid ═══ */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        {/* Dark scene */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            isDark ? "opacity-100" : "opacity-0",
          )}
          style={{
            background:
              "radial-gradient(ellipse at 50% -10%, rgba(56,189,248,0.22) 0%, transparent 55%), radial-gradient(ellipse at 85% 45%, rgba(139,92,246,0.16) 0%, transparent 55%), radial-gradient(ellipse at 12% 80%, rgba(16,185,129,0.14) 0%, transparent 50%), #0b0c11",
          }}
        />
        {/* Light scene */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            isDark ? "opacity-0" : "opacity-100",
          )}
          style={{
            background:
              "radial-gradient(ellipse at 50% -10%, rgba(132,204,22,0.16) 0%, transparent 55%), radial-gradient(ellipse at 85% 45%, rgba(99,102,241,0.12) 0%, transparent 55%), radial-gradient(ellipse at 12% 80%, rgba(6,182,212,0.10) 0%, transparent 50%), #fafafa",
          }}
        />

        {/* Faint blueprint grid, masked toward the edges */}
        <div
          className={cn(
            "absolute inset-0 opacity-40 dark:opacity-25 transition-opacity duration-700",
            "bg-[linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)]",
            "bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]",
          )}
        />

        {/* Accent glow behind the headline */}
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[420px] rounded-full bg-primary/10 blur-[110px]" />

        {/* Floating signal chips (decorative; xl+ only) */}
        <div
          data-hero-float-chip
          className="absolute left-[6%] top-[30%] hidden xl:flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur shadow-sm animate-[hero-float_7s_ease-in-out_infinite] will-change-transform"
        >
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span>{t("hero.terminal.streaming")}</span>
        </div>
        <div
          data-hero-float-chip
          className="absolute right-[6%] top-[56%] hidden xl:flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur shadow-sm animate-[hero-float_9s_ease-in-out_infinite] will-change-transform"
        >
          <Globe className="h-3.5 w-3.5 text-sky-400" />
          <span>{t("hero.terminal.liveStream")}</span>
        </div>
      </div>
      {/* ═══ Top spacing where the announcement badge used to sit ═══ */}
      <div aria-hidden className="relative z-30 pt-24" />
      {/* ═══ Headline + CTAs + trust metrics ═══ */}
      <div
        className={cn(
          "relative z-20 max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 my-auto flex flex-col items-center justify-center",
          revealClass(revealed),
        )}
        style={{ transitionDelay: revealed ? "260ms" : "0ms" }}
      >
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-[-0.03em] leading-[1.05] text-center">
          <span className="bg-gradient-to-b from-foreground via-foreground to-foreground/55 bg-clip-text text-transparent">
            {t("heroPrefix")}
          </span>{" "}
          <span className="mt-2 block">
            {/* Real hero copy, revealed by the chromatic sweep: each localized
                word sweeps in, holds, and hands off to the next phrase. */}
            <DiaTextReveal
              text={[t("heroWord1"), t("heroWord2"), t("heroWord3")]}
              repeat
              fixedWidth
              duration={1.1}
              holdDuration={1.9}
              colors={[
                "hsl(var(--primary))",
                "color-mix(in oklab, hsl(var(--primary)) 45%, #fff)",
                "hsl(var(--primary))",
              ]}
              textColor="hsl(var(--primary))"
              className="text-4xl font-bold tracking-[-0.03em] sm:text-5xl md:text-6xl lg:text-7xl"
            />
          </span>
        </h1>

        <p className="mt-5 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed text-center text-muted-foreground">
          {t("heroSubtitle")}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8">
          <Link
            href={`/${locale}/register`}
            className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full font-semibold text-sm bg-accent-gradient text-white shadow-xl shadow-primary/20 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <span>{t("ctaAccess")}</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>

          <Link
            href={`/${locale}/login`}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-sm border backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 bg-background/60 border-border text-foreground hover:bg-background"
          >
            <span>{t("heroCard.liveDemo")}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>

        {/* Trust metrics */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-10 pt-6 border-t border-border/40">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
            <Zap className="h-3.5 w-3.5 text-emerald-500" />
            {t("hero.metrics.uptime")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
            {t("hero.metrics.rating")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Globe className="h-3.5 w-3.5 text-sky-400" />
            {t("hero.metrics.regions")}
          </span>
        </div>
      </div>
      {/* ═══ Signal Strip — hero-level table of contents for the whole page ═══ */}
      <nav
        aria-label={t("hero.hub.label")}
        className={cn(
          "relative z-30 w-full max-w-3xl mx-auto px-4 sm:px-8 pb-6",
          revealClass(revealed),
        )}
        style={{ transitionDelay: revealed ? "420ms" : "0ms" }}
      >
        <div className="rounded-2xl border border-border/70 bg-background/70 backdrop-blur-md p-2.5 shadow-sm">
          <p className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {t("hero.hub.label")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {signalStripItems.map(({ href, labelKey, icon: Icon, accent }) => (
              <a
                key={href}
                href={href}
                className="group flex items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 border border-transparent hover:border-border hover:bg-background transition-all duration-300 hover:-translate-y-0.5 text-xs font-semibold text-foreground leading-tight"
              >
                <span
                  className={cn(
                    "shrink-0 grid place-items-center w-8 h-8 rounded-lg",
                    accent,
                    isDark ? "bg-white/5" : "bg-black/5",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {t(labelKey)}
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5" />
              </a>
            ))}
          </div>
        </div>
      </nav>

      {/* ═══ Bottom scroll cue ═══ */}
      <div
        className={cn(
          "relative z-30 pb-6 px-4 w-full flex flex-col items-center justify-center gap-3 pointer-events-auto",
          revealClass(revealed),
        )}
        style={{ transitionDelay: revealed ? "600ms" : "0ms" }}
      >
        <a
          href="#preview"
          aria-label={t("hero.scrollAria")}
          className="group inline-flex flex-col items-center gap-1.5 text-xs font-medium transition-all duration-300 hover:scale-105 text-muted-foreground hover:text-foreground"
        >
          <span className="uppercase tracking-widest text-[10px]">{t("hero.explore")}</span>
          <span className="w-5 h-8 rounded-full border border-current flex items-start justify-center p-1">
            <span className="w-1.5 h-2 rounded-full bg-primary animate-bounce" />
          </span>
        </a>
      </div>
    </section>
  );
}
