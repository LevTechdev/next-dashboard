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
import { advanceStayCountdown, formatStayClock } from "@/lib/stay-countdown";

/**
 * Long-stay session sentinel for the dashboard.
 *
 * The auth JWT lives 15 minutes; the dashboard session window modeled here is
 * 10 minutes. When 3 or fewer minutes remain, a non-blocking toast-style card
 * slides in with a live countdown and a "Stay signed in" CTA that rotates the
 * refresh token via /api/auth/refresh, records a durable stay-login grant on
 * the server (see /api/auth/stay-login), and restarts the window. Letting the
 * window lapse signs the user out.
 *
 * User activity (clicks/keys/scroll) does NOT extend the timer — this is a
 * deliberate long-stay prompt, not an idle detector.
 *
 * Two fixes for the "clicked Stay but got signed out anyway" class of bug:
 *
 *  1. VISIBILITY-AWARE COUNTDOWN. The window counts only time in which the tab
 *     was actually able to observe it: each tick measures wall-clock deltas but
 *     frozen deltas from hidden tabs (rAF stops there, timers throttle) are
 *     carried over, not consumed. A laptop resuming from sleep, or a tab left
 *     in the background for an hour, resumes its countdown where it left off
 *     instead of discovering 0:00 and an instant sign-out. The server remains
 *     the ultimate authority — its refresh-token lifetime is untouched.
 *
 *  2. A SERVER GRANT, NOT A LOCAL ONE. The grant used to live only in
 *     localStorage, so anything that deleted it (a redirect, another account
 *     on the same browser, a cleared site-data entry) silently ended the
 *     extension. The grant now also persists as `stayLoginUntil` on the
 *     user's refresh-token family; the sentinel reconciles against
 *     GET /api/auth/stay-login on mount and re-checks it before any sign-out,
 *     so a family-level grant protects every tab even after the flag is lost.
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

/** Server-side shape of GET /api/auth/stay-login. */
interface StayLoginStatus {
  granted: boolean;
  until: string | null;
}

/**
 * Whether this context is an INSTALLED PWA (display-mode: standalone).
 * Installed apps have deliberate, launch-like lifetimes — the user pinned
 * them to a dock/home-screen the way they would a native app — so the
 * 10-minute re-auth rhythm never applies; the server grant governs instead.
 */
function isInstalledPwa(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

export function SessionStayAlert({
  /** Test/e2e override: start the countdown at this many ms (skips the
   * ?stayDemo=1 query-param dance so real-timer tests stay sub-second). */
  startRemainingMs,
}: {
  startRemainingMs?: number;
} = {}) {
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
  // Wall-clock remainder that has NOT yet been consumed by visible time. The
  // tick loop drains it only while the tab can actually run its timers.
  const carriedRef = useRef(SESSION_WINDOW_MS);

  // Dev/e2e escape hatch: ?stayDemo=1 (or the startRemainingMs prop) starts
  // the countdown at the warning threshold so the alert (and its Stay CTA)
  // can be exercised without waiting out the full 10-minute window. The prop
  // wins; the query param no-ops in production builds.
  useEffect(() => {
    if (startRemainingMs !== undefined) {
      carriedRef.current = startRemainingMs;
      setRemaining(startRemainingMs);
      return;
    }
    if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") return;
    try {
      if (new URLSearchParams(window.location.search).get("stayDemo") === "1") {
        carriedRef.current = WARN_THRESHOLD_MS + 30_000;
        setRemaining(carriedRef.current);
      }
    } catch {
      /* ignore */
    }
  }, [startRemainingMs]);

  // Adopt a previously-granted extension from the server (durable across
  // browsers via the refresh-token family) and/or this browser session's
  // localStorage flag. Fires once on mount.
  useEffect(() => {
    let cancelled = false;
    const adopt = () => {
      if (cancelled) return;
      signedOutRef.current = false;
      setExtended(true);
      setRemaining(EXTENDED_WINDOW_MS);
      setVisible(false);
    };
    (async () => {
      // Installed PWAs are exempt from the alert rhythm entirely: the app
      // was deliberately installed, so its sessions live and die by the
      // server grant (stamped automatically for trusted devices at login),
      // not by a wall-clock countdown.
      if (isInstalledPwa()) {
        adopt();
        return;
      }
      try {
        const res = await fetch("/api/auth/stay-login");
        if (res.ok) {
          const status = (await res.json()) as StayLoginStatus;
          if (status.granted && !cancelled) {
            adopt();
            return;
          }
        }
      } catch {
        /* status unavailable — fall back to the local flag */
      }
      try {
        if (window.localStorage.getItem(STAY_FLAG_KEY) === "1" && !cancelled) adopt();
      } catch {
        /* storage unavailable — normal alert rhythm */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cross-tab coherence: another tab granting "Stay signed in" must
  // immediately extend THIS tab too. Without this, tab A (mounted before
  // the grant) keeps its own countdown and auto-signs the whole browser
  // out at 0:00 — the "clicked Stay but got signed out anyway" bug.
  useEffect(() => {
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
    // Last-moment guard, defense in depth alongside the storage event and the
    // server grant: before tearing the session down, re-check every place the
    // extension could have been granted — the local flag first (cheap), then
    // the server's family-level grant (authoritative). If another tab granted
    // the extension in the last tick, honor it instead of signing out.
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
    try {
      const res = await fetch("/api/auth/stay-login");
      if (res.ok) {
        const status = (await res.json()) as StayLoginStatus;
        if (status.granted) {
          signedOutRef.current = false;
          setExtended(true);
          setRemaining(EXTENDED_WINDOW_MS);
          setVisible(false);
          return;
        }
      }
    } catch {
      /* status unavailable — proceed with the sign-out */
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
    // Visibility-aware countdown: wall-clock deltas are consumed only while
    // the tab can actually run its timers. Hidden tabs (and whole sleeps)
    // freeze the countdown instead of burning it, so a user returns to the
    // same clock they left — never to 0:00 and a surprise sign-out.
    let lastAt = Date.now();
    const tick = setInterval(() => {
      const now = Date.now();
      const wallDelta = now - lastAt;
      lastAt = now;
      const visible = typeof document === "undefined" || document.visibilityState !== "hidden";
      const { remaining: left, expired } = advanceStayCountdown(
        carriedRef.current,
        wallDelta,
        visible,
      );
      carriedRef.current = left;
      if (expired) {
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
        // Record the durable grant FIRST — it is the part that survives a
        // lost flag, a redirect, or another account on this browser. The
        // grant is stamped on the refresh-token family the rotation just
        // renewed, so it can only succeed for a live session.
        try {
          await fetch("/api/auth/stay-login", { method: "POST" });
        } catch {
          /* non-fatal: the local extension still applies this session */
        }
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
        carriedRef.current = SESSION_WINDOW_MS;
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
                  {formatStayClock(remaining)}
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
