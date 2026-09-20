"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Joyride, STATUS, type Step, type TooltipRenderProps } from "react-joyride";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import enTourMessages from "../../i18n/locales/en.json";
import idTourMessages from "../../i18n/locales/id.json";
import jaTourMessages from "../../i18n/locales/ja.json";
import zhTourMessages from "../../i18n/locales/zh.json";

/**
 * Tour completion lives under the SAME per-user keyspace as the onboarding
 * checklist (`onboarding-tour-done:<userId>`), so one account finishing or
 * skipping the tour never suppresses it for another account on the same
 * browser — the exact global-key bug the checklist had. Signed-out visitors
 * and automation (Playwright — navigator.webdriver) never see the tour.
 */
const tourDoneKey = (userId: string | null | undefined) =>
  userId ? `onboarding-tour-done:${userId}` : null;
/** localStorage key remembering which locale the tour was last replayed in. */
export const TOUR_LOCALE_KEY = "tour_locale";
/** Window event that requests a tour replay in an optional locale. */
export const RESTART_TOUR_EVENT = "dashboard:restart-tour";

const TOUR_MESSAGES: Record<string, Record<string, string>> = {
  en: enTourMessages.onboardingTour as Record<string, string>,
  id: idTourMessages.onboardingTour as Record<string, string>,
  ja: jaTourMessages.onboardingTour as Record<string, string>,
  zh: zhTourMessages.onboardingTour as Record<string, string>,
};

/**
 * Resolve a tour string directly from the bundled locale messages for
 * `locale` — the active next-intl provider always renders the UI locale, but
 * a replay can request a different language than the UI is showing.
 */
function tourString(locale: string | undefined, key: string): string {
  const msgs = TOUR_MESSAGES[locale ?? "en"] ?? TOUR_MESSAGES.en;
  return msgs[key] ?? TOUR_MESSAGES.en[key] ?? key;
}

/**
 * Replay the product tour on demand, optionally in a specific language
 * (independent of the active UI locale). Called from Settings → restart.
 */
export function restartTour(locale?: string) {
  window.dispatchEvent(new CustomEvent(RESTART_TOUR_EVENT, { detail: { locale } }));
}

/**
 * Guided product tour for the dashboard — fully localized, themed with the
 * app's design tokens (no hardcoded indigo/violet), and shown once per
 * browser (completion persisted in localStorage). Settings can replay it in
 * any of the four locales via `restartTour(locale)`.
 */
export function OnboardingTour() {
  const uiLocale = useLocale();
  const { user, isLoading } = useAuth();
  const [run, setRun] = useState(false);
  // Locale the tour copy renders in: a replay request wins (lets a user
  // preview the tour in another language), otherwise the active UI locale.
  const [tourLocale, setTourLocale] = useState<string | null>(null);
  const pathname = usePathname();
  // Narrow viewports change which targets exist and where tooltips fit:
  //  - phones (<640px) render no header search bar, so that step is dropped
  //    instead of stalling the tour on a missing target;
  //  - tablet/mobile use "top" placements — "left" overflows the viewport.
  const [isPhone, setIsPhone] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    const phoneMq = window.matchMedia("(max-width: 639px)");
    const compactMq = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      setIsPhone(phoneMq.matches);
      setIsCompact(compactMq.matches);
    };
    sync();
    phoneMq.addEventListener("change", sync);
    compactMq.addEventListener("change", sync);
    return () => {
      phoneMq.removeEventListener("change", sync);
      compactMq.removeEventListener("change", sync);
    };
  }, []);

  // Only run the tour if THIS user hasn't completed it before and we are on
  // the dashboard home. Automation (Playwright e2e — navigator.webdriver)
  // never sees the tour: the spotlight overlay would hijack pointer/focus
  // interactions on every fresh browser context, breaking dashboard flows
  // under test.
  useEffect(() => {
    if (isLoading) return;
    const doneKey = tourDoneKey(user?.id);
    if (typeof navigator !== "undefined" && navigator.webdriver) return;
    const hasCompletedTour = doneKey ? localStorage.getItem(doneKey) === "true" : true;
    // Wait for hydration and check if we should run it
    const timer = setTimeout(() => {
      if (!hasCompletedTour && user?.id && pathname?.endsWith("/dashboard")) {
        setRun(true);
      }
    }, 1500); // Small delay to let the UI settle
    return () => clearTimeout(timer);
  }, [pathname, user?.id, isLoading]);

  /**
   * The tour is a once-per-user experience, so the completion flag is written
   * the moment the tour actually PRESENTS — not only when the visitor reaches
   * the end or presses Skip. Persisting on finish/skip alone meant any tour
   * that was abandoned mid-way (navigating away, closing the tab, the browser
   * dying) left no trace at all and replayed on every following login.
   * The ref keeps this to one write per run: `onEvent` fires for every step.
   */
  const markedSeen = useRef(false);
  const markTourSeen = useCallback(() => {
    if (markedSeen.current) return;
    const doneKey = tourDoneKey(user?.id);
    if (!doneKey) return;
    markedSeen.current = true;
    try {
      localStorage.setItem(doneKey, "true");
    } catch {
      /* storage unavailable — the tour may replay, nothing else breaks */
    }
  }, [user?.id]);

  // Replay support: `restartTour(locale)` clears completion, records the
  // requested language, and bumps a nonce that re-triggers the run —
  // replaying the tour in the chosen language.
  const [replayNonce, setReplayNonce] = useState(0);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ locale?: string }>).detail;
      const doneKey = tourDoneKey(user?.id);
      if (doneKey) localStorage.removeItem(doneKey);
      // A replay re-presents the tour, so the seen-once latch must re-arm —
      // otherwise the flag cleared above would never be rewritten and the
      // tour would come back on the next login.
      markedSeen.current = false;
      if (detail?.locale) localStorage.setItem(TOUR_LOCALE_KEY, detail.locale);
      setTourLocale(detail?.locale ?? null);
      setReplayNonce((n) => n + 1);
    };
    window.addEventListener(RESTART_TOUR_EVENT, handler);
    return () => window.removeEventListener(RESTART_TOUR_EVENT, handler);
  }, [user?.id]);

  useEffect(() => {
    if (replayNonce === 0) return;
    const timer = setTimeout(() => setRun(true), 400);
    return () => clearTimeout(timer);
  }, [replayNonce]);

  const copyLocale = tourLocale ?? uiLocale;

  // Precision targeting: each step scrolls the spotlighted element exactly to
  // the top of the viewport (minus the header) — Joyride's default centers
  // loosely and can leave the target under the sticky header. scrollOffset 0
  // + a header-aware CSS scroll-margin gives a deterministic jump. Narrow
  // screens use "top" placements ("left" overflows) and phones skip the
  // search step entirely (the target doesn't exist there).
  const steps: Step[] = [
    {
      target: ".tour-dashboard-metrics",
      title: tourString(copyLocale, "stepMetricsTitle"),
      content: tourString(copyLocale, "stepMetricsDesc"),
      placement: "bottom",
      skipBeacon: true,
      spotlightRadius: 16,
      spotlightPadding: 6,
      scrollOffset: 0,
    },
    {
      target: ".tour-revenue-chart",
      title: tourString(copyLocale, "stepRevenueTitle"),
      content: tourString(copyLocale, "stepRevenueDesc"),
      placement: "top",
      skipBeacon: true,
      spotlightRadius: 16,
      spotlightPadding: 6,
      scrollOffset: 0,
    },
    {
      target: ".tour-recent-sales",
      title: tourString(copyLocale, "stepSalesTitle"),
      content: tourString(copyLocale, "stepSalesDesc"),
      placement: isCompact ? "top" : "left",
      skipBeacon: true,
      spotlightRadius: 16,
      spotlightPadding: 6,
      scrollOffset: 0,
    },
    // Phones render no header search bar — a step targeting it can never
    // resolve and Joyride stalls mid-tour. Only include it when it exists.
    ...(isPhone
      ? []
      : [
          {
            target: ".tour-search-bar",
            title: tourString(copyLocale, "stepSearchTitle"),
            content: tourString(copyLocale, "stepSearchDesc"),
            placement: "bottom" as const,
            skipBeacon: true,
            spotlightRadius: 16,
            spotlightPadding: 4,
            scrollOffset: 0,
          },
        ]),
  ];

  // Completion hook: react-joyride v3 exposes `onEvent`. `running` is emitted
  // from the tour's first event onward, so it latches the seen-once flag as
  // soon as the visitor is actually looking at the tour; FINISHED/SKIPPED then
  // close it out.
  const handleJoyrideCallback = (data: { status: string }) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (status === STATUS.RUNNING || finishedStatuses.includes(status)) {
      markTourSeen();
    }
    if (finishedStatuses.includes(status)) {
      setRun(false);
      setTourLocale(null);
    }
  };

  // Custom tooltip — token-styled, rounded, with primary accent. Skip lives
  // top-right via Joyride's own skipProps. Copy strings come from the
  // replay-selected locale's message bundle.
  const Tooltip = ({
    continuous,
    index,
    size,
    step,
    backProps,
    closeProps,
    primaryProps,
    skipProps,
  }: TooltipRenderProps) => (
    <div className="relative w-[calc(100vw-32px)] max-w-[320px] rounded-2xl border border-border bg-card text-card-foreground shadow-xl p-4">
      <button
        {...skipProps}
        className="absolute top-2.5 right-3 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {tourString(copyLocale, "skip")}
      </button>
      <div className="flex items-center gap-2 mb-1.5 pr-14">
        <span className="flex items-center justify-center h-6 w-6 rounded-lg bg-primary/10 text-primary shrink-0">
          <Compass className="h-3.5 w-3.5" />
        </span>
        {step.title && <p className="text-sm font-semibold leading-tight">{step.title}</p>}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{step.content}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
          {tourString(copyLocale, "stepCount")
            .replace("{current}", String(index + 1))
            .replace("{total}", String(size))}
        </span>
        <div className="flex items-center gap-1.5">
          {!continuous && (
            <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" {...closeProps}>
              {tourString(copyLocale, "close")}
            </Button>
          )}
          {continuous && (
            <>
              {index > 0 && (
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" {...backProps}>
                  {tourString(copyLocale, "back")}
                </Button>
              )}
              <Button size="sm" className="h-7 px-3 text-xs" {...primaryProps}>
                {index === size - 1
                  ? tourString(copyLocale, "finish")
                  : tourString(copyLocale, "next")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Joyride
      onEvent={handleJoyrideCallback}
      continuous
      run={run}
      scrollToFirstStep
      steps={steps}
      tooltipComponent={Tooltip}
      styles={{
        overlay: { backgroundColor: "rgba(0, 0, 0, 0.55)" },
      }}
    />
  );
}
