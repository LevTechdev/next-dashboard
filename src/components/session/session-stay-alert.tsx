"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { refreshAccessTokenDetailed } from "@/lib/client-refresh";

/**
 * Long-stay session sentinel for the dashboard.
 *
 * The auth JWT lives 15 minutes; the dashboard session window modeled here is
 * 10 minutes. When 3 or fewer minutes remain, a non-blocking toast-style card
 * slides in with a live countdown and a "Stay signed in" CTA that rotates the
 * refresh token via /api/auth/refresh and restarts the window. Letting the
 * window lapse signs the user out.
 *
 * User activity (clicks/keys/scroll) does NOT extend the timer — this is a
 * deliberate long-stay prompt, not an idle detector.
 */
const SESSION_WINDOW_MS = 10 * 60 * 1000; // total dashboard session window
const WARN_THRESHOLD_MS = 3 * 60 * 1000; // show the card at 3:00 remaining
const TICK_MS = 1000;
// "Stay signed in" grants a long working window and suppresses the alert
// entirely until the user signs out manually — nobody doing a full workday
// wants a 10-minute interruption rhythm.
const EXTENDED_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours
const STAY_FLAG_KEY = "session_stay_signed_in";

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SessionStayAlert() {
  const t = useTranslations("sessionStay");
  const router = useRouter();
  const [remaining, setRemaining] = useState(SESSION_WINDOW_MS);
  const [staying, setStaying] = useState(false);
  const [visible, setVisible] = useState(false);
  // After "Stay signed in" the sentinel goes dormant for the rest of the
  // browser session — no more countdowns, no auto sign-out — until the user
  // explicitly logs out (which clears the flag).
  const [extended, setExtended] = useState(false);
  const signedOutRef = useRef(false);

  // Dev/e2e escape hatch: ?stayDemo=1 starts the countdown at the warning
  // threshold so the alert (and its Stay CTA) can be exercised without
  // waiting out the full 10-minute window. No-ops in production builds.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    try {
      if (new URLSearchParams(window.location.search).get("stayDemo") === "1") {
        setRemaining(WARN_THRESHOLD_MS + 30_000);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Honor a previously-granted extension across reloads within the same
  // browser session.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STAY_FLAG_KEY) === "1") {
        setExtended(true);
        setRemaining(EXTENDED_WINDOW_MS);
      }
    } catch {
      /* storage unavailable — normal alert rhythm */
    }
    // Cross-tab coherence: another tab granting "Stay signed in" must
    // immediately extend THIS tab too. Without this, tab A (mounted before
    // the grant) keeps its own countdown and auto-signs the whole browser
    // out at 0:00 — the "clicked Stay but got signed out anyway" bug.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STAY_FLAG_KEY) return;
      if (e.newValue === "1") {
        signedOutRef.current = false;
        setExtended(true);
        setRemaining(EXTENDED_WINDOW_MS);
        setVisible(false);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const signOut = useCallback(async () => {
    if (signedOutRef.current) return;
    // Last-moment guard: re-read the stay flag before tearing the session
    // down. If another tab granted the extension in the last tick, honor it
    // instead of signing out (defense in depth alongside the storage event).
    try {
      if (window.localStorage.getItem(STAY_FLAG_KEY) === "1") {
        signedOutRef.current = false;
        setExtended(true);
        setRemaining(EXTENDED_WINDOW_MS);
        setVisible(false);
        return;
      }
    } catch {
      /* ignore */
    }
    signedOutRef.current = true;
    try {
      window.localStorage.removeItem(STAY_FLAG_KEY);
    } catch {
      /* ignore */
    }
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors — the local session is cleared regardless.
    }
    router.push("/en/login");
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (extended) return; // dormant — the long window runs quietly
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const left = SESSION_WINDOW_MS - (Date.now() - startedAt);
      if (left <= 0) {
        setRemaining(0);
        clearInterval(tick);
        void signOut();
        return;
      }
      setRemaining(left);
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [signOut, extended]);

  useEffect(() => {
    setVisible(remaining <= WARN_THRESHOLD_MS && remaining > 0);
  }, [remaining]);

  const handleStay = useCallback(async () => {
    setStaying(true);
    try {
      // Single-flight: shares the gate with the fetch wrapper's 401-recovery,
      // so this rotation can never present a token another in-flight rotation
      // just consumed (reuse detection revokes the family = surprise sign-out).
      const { ok, status } = await refreshAccessTokenDetailed();
      if (ok) {
        // Grant the long working window: no more alerts, no auto sign-out,
        // until the user signs out manually (flag persists across reloads).
        try {
          window.localStorage.setItem(STAY_FLAG_KEY, "1");
        } catch {
          /* ignore */
        }
        signedOutRef.current = false;
        setExtended(true);
        setRemaining(EXTENDED_WINDOW_MS);
        setVisible(false);
        router.refresh();
      } else if (status === 401) {
        // Hard rejection — refresh token revoked/expired. Sign out now. A 403
        // (CSRF rejection) or 0/5xx is treated as transient: the token was
        // NOT judged invalid, so sign-out would be wrong — re-arm instead.
        await signOut();
      } else {
        // Network failure, 403, or transient error (0/5xx): keep the session
        // and re-arm the countdown — never sign out on an ambiguous outcome.
        // Tell the user WHY the alert came back, so the re-arm never reads as
        // a dead button.
        signedOutRef.current = false;
        setRemaining(SESSION_WINDOW_MS);
        setVisible(false);
        toast.error(t("stayFailed"));
      }
    } catch {
      await signOut();
    } finally {
      setStaying(false);
    }
  }, [router, signOut, t]);

  const urgent = remaining <= 60 * 1000;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.35, ease: easeSmooth }}
          className={cn(
            "fixed bottom-20 right-4 z-[60] w-[calc(100vw-2rem)] max-w-xs sm:bottom-6 sm:right-6 sm:max-w-sm",
            "rounded-2xl border bg-card/95 text-card-foreground shadow-2xl backdrop-blur-xl",
            urgent ? "border-destructive/40" : "border-amber-500/40",
          )}
          role="alert"
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  urgent
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-500",
                )}
              >
                <Clock className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{t("title")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {t("description")}
                </p>
                <p
                  className={cn(
                    "mt-2 text-2xl font-bold tabular-nums leading-none",
                    urgent ? "text-destructive" : "text-foreground",
                  )}
                >
                  {formatClock(remaining)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                className="h-8 flex-1 gap-1.5 text-xs"
                disabled={staying}
                onClick={() => void handleStay()}
                data-testid="stay-signed-in-btn"
              >
                {staying ? <Clock className="h-3.5 w-3.5 animate-spin" /> : null}
                {t("stay")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                disabled={staying}
                onClick={() => void signOut()}
                data-testid="session-sign-out-btn"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t("signOut")}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
