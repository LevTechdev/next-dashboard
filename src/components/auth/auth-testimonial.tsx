"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Decorative customer-review panel used on the right side of the auth pages
 * (login, sign up, forgot password, reset password). All copy comes from the
 * `auth` translation namespace, and the tinted gradient + blobs follow the
 * Settings → Appearance accent color instead of a fixed palette.
 */
export function AuthTestimonial({ className }: { className?: string }) {
  const t = useTranslations("auth");

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-primary/25 via-primary/5 to-primary/20 flex items-end p-6",
        className,
      )}
    >
      {/* Soft decorative blobs */}
      <div className="absolute top-0 right-0 h-[300px] w-[300px] -translate-y-1/3 translate-x-1/3 rounded-full bg-primary/30 blur-[80px]" />
      <div className="absolute bottom-1/4 left-0 h-[220px] w-[220px] -translate-x-1/2 rounded-full bg-primary/15 blur-[60px]" />

      {/* Glass card */}
      <div className="relative z-10 w-full rounded-[1.5rem] border border-white/40 bg-white/70 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/40">
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/30 bg-white px-4 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200">
            {t("testimonialBadge1")}
          </span>
          <span className="rounded-full border border-white/30 bg-white px-4 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200">
            {t("testimonialBadge2")}
          </span>
        </div>

        <blockquote className="mb-8 text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-100 sm:text-xl">
          {t("testimonialQuote")}
        </blockquote>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {t("testimonialName")}
            </p>
            <p className="mt-0.5 text-xs font-medium text-zinc-800/80 dark:text-zinc-300/80">
              {t("testimonialRole")}
            </p>
          </div>
          <div className="flex gap-2" aria-hidden="true">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100">
              <ChevronLeft className="h-4 w-4" />
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
