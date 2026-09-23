"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ChevronRight,
  X,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Compass,
} from "lucide-react";
import { RESTART_TOUR_EVENT } from "@/components/ui/onboarding-tour";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

/** Small circular progress ring showing onboarding completion. */
function ProgressRing({ percent }: { percent: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 32 32" className="h-12 w-12 -rotate-90">
        <circle cx="16" cy="16" r={r} fill="none" strokeWidth="3" className="stroke-muted" />
        <motion.circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-primary"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * percent) / 100 }}
          transition={{ duration: 0.8, ease: easeSmooth }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary tabular-nums">
        {percent}%
      </span>
    </div>
  );
}

export function OnboardingChecklist() {
  const t = useTranslations("onboarding");
  const { steps, completeStep, progress, dismiss, isDismissed, isComplete } = useOnboarding();
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "en";
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (isComplete && !isDismissed) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, isDismissed]);

  if (isDismissed || isComplete) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeSmooth }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm mb-6">
        {/* Primary-tinted header band — dynamic accent, no hardcoded colors. */}
        <div className="relative border-b border-border/60 bg-gradient-to-r from-primary/[0.08] via-primary/[0.04] to-transparent px-5 py-4">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-3.5">
            <ProgressRing percent={progress} />
            <div className="min-w-0 flex-1 basis-48">
              <div className="flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5 text-primary" />
                <p className="text-sm font-semibold leading-tight">{t("title")}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{t("subtitle")}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
              {/* Launch the guided product tour (same per-user keyspace).
                  Icon-only on phones (the labelled button needs room), so the
                  tour stays reachable at every breakpoint. */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.dispatchEvent(new CustomEvent(RESTART_TOUR_EVENT))}
                className="h-7 w-7 sm:hidden text-primary"
                aria-label={t("takeTour")}
              >
                <Compass className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.dispatchEvent(new CustomEvent(RESTART_TOUR_EVENT))}
                className="hidden sm:inline-flex h-7 px-2.5 text-xs text-primary gap-1"
              >
                <Compass className="h-3 w-3" />
                {t("takeTour")}
              </Button>
              {/* Dismiss: icon-only on phones (labelled duplicates it on sm+). */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:hidden"
                onClick={dismiss}
                aria-label={t("dismiss")}
              >
                <X className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismiss}
                className="hidden sm:inline-flex h-7 px-2.5 text-xs text-muted-foreground"
              >
                {t("dismiss")}
              </Button>
            </div>
          </div>
        </div>

        {/* Celebration burst on completion. */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] pointer-events-none"
            >
              <motion.span
                initial={{ scale: 0.4 }}
                animate={{ scale: [0.4, 1.2, 1] }}
                transition={{ duration: 0.7, ease: easeSmooth }}
                className="text-5xl"
              >
                🎉
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: easeSmooth }}
              className="overflow-hidden"
            >
              <div className="p-3 grid gap-1.5 sm:gap-2">
                {steps.map((step, index) => {
                  return (
                    <motion.div
                      key={step.id}
                      initial={{ x: -14, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.08 * index, duration: 0.4, ease: easeSmooth }}
                    >
                      <Link
                        href={`/${locale}${step.href}`}
                        onClick={() => completeStep(step.id)}
                        className={cn(
                          "group flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200",
                          step.completed
                            ? "bg-muted/40 border-transparent opacity-60"
                            : "bg-card hover:border-primary/30 hover:bg-primary/[0.04] hover:shadow-sm border-border/70",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold transition-colors",
                            step.completed
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                          )}
                        >
                          {step.completed ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4
                            className={cn(
                              "text-[13px] font-medium leading-tight",
                              step.completed && "line-through text-muted-foreground",
                            )}
                          >
                            {t(step.labelKey)}
                          </h4>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {t(step.descKey)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
