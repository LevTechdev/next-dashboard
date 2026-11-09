"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/** How long a review stays on screen before the panel advances. */
const AUTOPLAY_MS = 7000;

interface TestimonialSlide {
  quote: string;
  name: string;
  role: string;
  badges: string[];
}

/** i18n messages are untyped at runtime — keep only well-formed slides. */
function toSlides(value: unknown): TestimonialSlide[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const slide = entry as Record<string, unknown>;
    if (typeof slide.quote !== "string" || typeof slide.name !== "string") return [];
    return [
      {
        quote: slide.quote,
        name: slide.name,
        role: typeof slide.role === "string" ? slide.role : "",
        badges: Array.isArray(slide.badges)
          ? slide.badges.filter((badge): badge is string => typeof badge === "string")
          : [],
      },
    ];
  });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Decorative customer-review panel used on the right side of the auth pages
 * (login, sign up, forgot password, reset password).
 *
 * All copy comes from the `auth` translation namespace, so each locale gets its
 * own three reviews. The panel auto-advances every {@link AUTOPLAY_MS} with a
 * progress bar, but yields control the moment a visitor hovers, focuses it, or
 * switches tabs — and it never auto-advances for `prefers-reduced-motion`.
 * Prev/next buttons, dots, and arrow keys all jump between reviews.
 */
export function AuthTestimonial({ className }: { className?: string }) {
  const t = useTranslations("auth");
  const reduceMotion = usePrefersReducedMotion();

  const slides = toSlides(t.raw("testimonials"));
  const count = slides.length;

  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  // A background tab should not burn through reviews unseen.
  useEffect(() => {
    const onVisibility = () => setTabHidden(document.visibilityState === "hidden");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const activeIndex = count > 0 ? index % count : 0;
  const paused = hovering || focused || tabHidden;

  useEffect(() => {
    if (reduceMotion || paused || count < 2) return;
    const timer = window.setTimeout(() => goTo(activeIndex + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, count, goTo, paused, reduceMotion]);

  if (count === 0) return null;

  const slide = slides[activeIndex];
  const position = `${String(activeIndex + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
  const slideAnimation = reduceMotion
    ? undefined
    : { animation: "testimonial-in 520ms cubic-bezier(0.16, 1, 0.3, 1) both" };

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-primary/25 via-primary/5 to-primary/20 flex items-end p-6",
        className,
      )}
      role="group"
      aria-roledescription="carousel"
      aria-label={t("testimonialHeading")}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goTo(activeIndex - 1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          goTo(activeIndex + 1);
        }
      }}
    >
      {/* Soft decorative blobs */}
      <div className="absolute top-0 right-0 h-[300px] w-[300px] -translate-y-1/3 translate-x-1/3 rounded-full bg-primary/30 blur-[80px]" />
      <div className="absolute bottom-1/4 left-0 h-[220px] w-[220px] -translate-x-1/2 rounded-full bg-primary/15 blur-[60px]" />

      {/* Glass card */}
      <div className="relative z-10 w-full overflow-hidden rounded-[1.5rem] border border-white/40 bg-white/70 p-8 pt-9 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/40">
        {/* Autoplay progress for the review currently on screen. */}
        {count > 1 && !reduceMotion && (
          <div
            className="absolute inset-x-0 top-0 h-[3px] overflow-hidden bg-white/30 dark:bg-white/10"
            aria-hidden
          >
            <div
              key={activeIndex}
              className="h-full w-full origin-left bg-primary/80"
              style={{
                animation: `testimonial-progress ${AUTOPLAY_MS}ms linear forwards`,
                animationPlayState: paused ? "paused" : "running",
              }}
            />
          </div>
        )}

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Quote className="h-3.5 w-3.5 text-primary" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
              {t("testimonialHeading")}
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">
            {position}
          </span>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {slide.badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-white/30 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-800 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200"
            >
              {badge}
            </span>
          ))}
        </div>

        <div className="min-h-[9.5rem] sm:min-h-[8.5rem]">
          <blockquote
            key={`quote-${activeIndex}`}
            className="text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-100 sm:text-xl"
            style={slideAnimation}
          >
            “{slide.quote}”
          </blockquote>

          <div
            key={`author-${activeIndex}`}
            className="mt-5 flex items-center gap-3"
            style={slideAnimation}
          >
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary"
            >
              {initials(slide.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {slide.name}
              </p>
              <p className="mt-0.5 truncate text-xs font-medium text-zinc-800/80 dark:text-zinc-300/80">
                {slide.role}
              </p>
            </div>
          </div>
        </div>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {t("testimonialPosition", { current: activeIndex + 1, total: count })}
        </p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {slides.map((entry, dotIndex) => (
              <button
                key={entry.name + dotIndex}
                type="button"
                onClick={() => goTo(dotIndex)}
                aria-label={t("testimonialGoTo", { index: dotIndex + 1 })}
                aria-current={dotIndex === activeIndex ? "true" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2",
                  dotIndex === activeIndex
                    ? "w-6 bg-zinc-900 dark:bg-white"
                    : "w-1.5 bg-zinc-900/25 hover:bg-zinc-900/45 dark:bg-white/30 dark:hover:bg-white/50",
                )}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              aria-label={t("testimonialPrev")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-900 shadow-sm transition-transform hover:-translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              aria-label={t("testimonialNext")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-900 shadow-sm transition-transform hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
