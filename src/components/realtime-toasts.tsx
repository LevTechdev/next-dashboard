"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCircle2, Info, XCircle, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTranslations } from "next-intl";
import { notificationStatusForType, type NotificationStatus } from "@/lib/notification-taxonomy";

/**
 * Boardui-style floating notification surface.
 * ─────────────────────────────────────────────────
 * A viewport-anchored stack (bottom-right) that renders realtime SSE events
 * as rich cards instead of plain sonner toasts:
 *
 *   • circular status chip (success / error / information / neutral)
 *   • initials AVATAR for customer events (avatar beats icon, like boardui)
 *   • title + relative timestamp header + description
 *   • optional action buttons (View / Dismiss)
 *   • 3px linear COUNTDOWN BAR draining along the card's bottom edge
 *   • auto-dismiss after TOAST_DURATION with exit blur/slide
 *
 * The dashboard layout mounts <RealtimeToastsBridge />, which subscribes to
 * the same realtime feed the bell and activity feed read.
 */

export type ToastStatus = NotificationStatus;

export interface FloatingToast {
  id: string;
  title: string;
  description?: string;
  /** Notification type key — drives status + avatar derivation. */
  type: string;
  createdAt: number;
  /** Optional primary action; renders as a compact pill button. */
  action?: { label: string; href: string };
  /** Presence dot color for the avatar variant. */
  presence?: "online" | "busy" | "offline";
}

const STATUS_CHIP: Record<ToastStatus, { classes: string; Icon: LucideIcon }> = {
  neutral: { classes: "bg-muted text-muted-foreground", Icon: Bell },
  information: {
    classes: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
    Icon: Info,
  },
  success: {
    classes: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
  error: {
    classes: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300",
    Icon: XCircle,
  },
};

const PRESENCE: Record<NonNullable<FloatingToast["presence"]>, string> = {
  online: "bg-emerald-500",
  busy: "bg-rose-500",
  offline: "bg-muted-foreground/40",
};

/** Default visibility window per toast (ms) — mirrors the reference UX. */
const TOAST_DURATION = 6000;

/**
 * Status chip derivation — now a thin alias over the shared taxonomy
 * (src/lib/notification-taxonomy.ts) so toasts, the bell panel, and the feed
 * page can never diverge.
 */
export function toastStatusForType(type: string): ToastStatus {
  return notificationStatusForType(type);
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function relativeTime(
  from: number,
  now: number,
  t: {
    justNow: string;
    secondsAgo: (v: number) => string;
    minutesAgo: (v: number) => string;
    hoursAgo: (v: number) => string;
  },
): string {
  const s = Math.max(0, Math.floor((now - from) / 1000));
  if (s < 5) return t.justNow;
  if (s < 60) return t.secondsAgo(s);
  const m = Math.floor(s / 60);
  if (m < 60) return t.minutesAgo(m);
  const h = Math.floor(m / 60);
  return t.hoursAgo(h);
}

function ToastCard({
  toast,
  onDismiss,
  now,
}: {
  toast: FloatingToast;
  onDismiss: (id: string) => void;
  now: number;
}) {
  const tcommon = useTranslations("common");
  const status = toastStatusForType(toast.type);
  const { Icon } = STATUS_CHIP[status];
  const isCustomer = toast.type === "customer";
  const initials = initialsOf(toast.title.replace(/^(New|VIP)\s+/i, ""));

  return (
    <motion.div
      layout
      role="status"
      data-testid="realtime-toast"
      data-toast-type={toast.type}
      initial={{ opacity: 0, y: 16, scale: 0.96, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 8, scale: 0.96, filter: "blur(3px)" }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border border-border bg-background p-4 pr-11 shadow-lg shadow-black/5 dark:shadow-black/30"
    >
      {/* Leading visual — avatar takes precedence over the status chip */}
      {isCustomer ? (
        <span className="relative shrink-0">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {initials}
          </span>
          {toast.presence && (
            <span
              aria-hidden
              className={cn(
                "absolute bottom-0 right-0 size-3 rounded-full border-2 border-background",
                PRESENCE[toast.presence],
              )}
            />
          )}
        </span>
      ) : (
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            STATUS_CHIP[status].classes,
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-sm font-medium text-foreground">{toast.title}</p>
          <span className="text-xs text-muted-foreground">
            {relativeTime(toast.createdAt, now, {
              justNow: tcommon("justNow"),
              secondsAgo: (v) => tcommon("secondsAgo", { count: v }),
              minutesAgo: (v) => tcommon("minutesAgo", { count: v }),
              hoursAgo: (v) => tcommon("hoursAgo", { count: v }),
            })}
          </span>
        </div>
        {toast.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{toast.description}</p>
        )}
        {toast.action && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <a
              href={toast.action.href}
              className="inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            >
              {toast.action.label}
            </a>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              {tcommon("dismiss")}
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label={tcommon("dismissNotification")}
        onClick={() => onDismiss(toast.id)}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>

      {/* 3px countdown bar draining linearly across the toast duration */}
      <motion.span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-primary"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: TOAST_DURATION / 1000, ease: "linear" }}
      />
    </motion.div>
  );
}

export function RealtimeToasts({
  toasts,
  onDismiss,
}: {
  toasts: FloatingToast[];
  onDismiss: (id: string) => void;
}) {
  const tcommon = useTranslations("common");
  // Portal only after hydration (SSR has no document.body).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Ticking clock drives the relative timestamps.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-label={tcommon("notifications")}
      data-testid="realtime-toast-viewport"
      className="pointer-events-none fixed bottom-3 right-3 z-[60] flex w-[min(380px,calc(100vw-24px))] flex-col gap-3 sm:bottom-6 sm:right-6"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            layout
            key={t.id}
            className="pointer-events-auto w-full"
            transition={{
              layout: { type: "spring", stiffness: 520, damping: 42, mass: 0.7 },
            }}
          >
            <ToastCard toast={t} onDismiss={onDismiss} now={now} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

/**
 * Bridge: subscribes to the realtime feed (via a prop-provided subscribe fn
 * so this file stays decoupled from the SSE provider) and manages the toast
 * lifecycle — auto-dismiss timers, max stack size (3), replayed-event skip.
 */
export function useToastStack() {
  const [toasts, setToasts] = useState<FloatingToast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  };

  const push = (toast: FloatingToast) => {
    setToasts((prev) => [...prev, toast].slice(-3));
    const timer = window.setTimeout(() => dismiss(toast.id), TOAST_DURATION);
    timersRef.current.set(toast.id, timer);
  };

  // Cleanup pending timers on unmount.
  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) window.clearTimeout(timer);
      timersRef.current.clear();
    },
    [],
  );

  return { toasts, push, dismiss };
}

/** Hook shape for consumers that only need the auth context (tests). */
export function useToastAuthGate() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}
