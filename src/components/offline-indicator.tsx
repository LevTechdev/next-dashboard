"use client";

import { useState, useEffect, useCallback } from "react";
import { WifiOff, Wifi, RefreshCw, CloudUpload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { countQueuedRequests, flushQueue, pruneStaleRequests } from "@/lib/offline-queue";

export function OfflineIndicator() {
  const t = useTranslations("pwa");
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [flushing, setFlushing] = useState(false);

  const refreshPending = useCallback(async () => {
    try {
      setPendingCount(await countQueuedRequests());
    } catch {
      // IndexedDB unavailable (private mode) — the queue just stays empty.
    }
  }, []);

  // Flush pending mutations when connectivity returns.
  const flushWhenOnline = useCallback(async () => {
    setFlushing(true);
    try {
      await pruneStaleRequests();
      const results = await flushQueue();
      const okCount = results.filter((r) => r.ok).length;
      if (okCount > 0) {
        // Toast via the realtime surface is overkill; sonner is already the
        // app-wide toast channel for background confirmations.
        const { toast } = await import("sonner");
        toast.success(t("syncedToast", { count: okCount }));
      }
    } finally {
      setFlushing(false);
      await refreshPending();
    }
  }, [refreshPending, t]);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    void refreshPending();
    void pruneStaleRequests();

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 4000);
      void flushWhenOnline();
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // Periodic catch-up: tab alive while connectivity flaps.
    const poll = window.setInterval(() => {
      setIsOffline(!navigator.onLine);
      void refreshPending();
    }, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(poll);
    };
  }, [flushWhenOnline, refreshPending]);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999]"
          data-testid="offline-banner"
        >
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-amber-500/90 text-amber-950 font-medium text-xs shadow-lg backdrop-blur-md border border-amber-400/50">
            <div className="flex items-center gap-2">
              <WifiOff className="h-3.5 w-3.5 animate-pulse" />
              <span>{t("offlineBanner")}</span>
            </div>
            {pendingCount > 0 && (
              <span
                data-testid="offline-queue-count"
                className="flex items-center gap-1 rounded-full bg-amber-950/15 px-1.5 py-0.5 text-[10px] font-bold"
              >
                <CloudUpload className="h-3 w-3" />
                {pendingCount}
              </span>
            )}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1 bg-amber-950/10 hover:bg-amber-950/20 px-2 py-0.5 rounded transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              {t("retry")}
            </button>
          </div>
        </motion.div>
      )}

      {showReconnected && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/90 text-white font-medium text-xs shadow-lg backdrop-blur-md border border-emerald-400/50">
            <Wifi className="h-3.5 w-3.5" />
            <span>
              {pendingCount > 0
                ? t("syncingBanner", { count: pendingCount })
                : t("reconnectedBanner")}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
