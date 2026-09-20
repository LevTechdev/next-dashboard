"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CloudUpload, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { countQueuedRequests, flushQueue, pruneStaleRequests } from "@/lib/offline-queue";

/**
 * Offline fallback page — served by the service worker when a navigation
 * fails (see public/sw.js). Also usable directly at /offline.
 *
 * Sits OUTSIDE the [locale] segment on purpose: the SW must be able to serve
 * it from cache with zero server involvement, so it cannot depend on
 * locale-aware routing. It reads the active locale from localStorage (kept in
 * sync by useLocale persistence elsewhere) and loads matching messages from
 * the prebuilt bundles.
 */
export default function OfflinePage() {
  // The locale JSON bundles are deeply typed via next-intl; the offline page
  // only reads `pwa.*` strings, so a minimal structural view is enough.
  const [messages, setMessages] = useState<{ pwa?: Record<string, string> } | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState<number | null>(null);

  useEffect(() => {
    const locale = (() => {
      try {
        return localStorage.getItem("locale") || document.documentElement.lang || "en";
      } catch {
        return "en";
      }
    })();
    import(`@/i18n/locales/${locale}.json`)
      .then((m: { default: { pwa?: Record<string, string> } }) => setMessages(m.default ?? m))
      .catch(() => {
        import("@/i18n/locales/en.json").then((m: { default: { pwa?: Record<string, string> } }) =>
          setMessages(m.default ?? m),
        );
      });
  }, []);

  const refreshQueue = async () => {
    try {
      await pruneStaleRequests();
      setPending(await countQueuedRequests());
    } catch {
      setPending(null);
    }
  };

  useEffect(() => {
    void refreshQueue();
    const onOnline = () => void refreshQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const results = await flushQueue();
      setSynced(results.filter((r) => r.ok).length);
      await refreshQueue();
    } finally {
      setSyncing(false);
    }
  };

  const t = (key: string): string => {
    const pwa = messages?.pwa ?? {};
    const value = pwa[key];
    if (value == null) return key;
    if (pending !== null && key === "queuePending")
      return value.replace("{count}", String(pending));
    return value;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
      <div className="p-6 rounded-2xl bg-gray-100 dark:bg-gray-800/60 mb-6">
        <WifiOff className="h-16 w-16 text-gray-400 dark:text-gray-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
        {t("offlineTitle")}
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm mb-4">
        {t("offlineDesc")}
      </p>

      {/* Offline queue status — mutations made while offline are durable here */}
      <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <CloudUpload className="h-4 w-4 text-primary" />
          {pending === null
            ? t("queueEmpty")
            : pending > 0
              ? t("queuePending").replace("{count}", String(pending))
              : t("queueEmpty")}
        </div>
        <p className="mt-1.5 text-xs text-gray-400">{t("offlineQueueNote")}</p>
        {pending !== null && pending > 0 && navigator.onLine && (
          <Button size="sm" className="mt-3 gap-1.5" onClick={handleSyncNow} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {t("syncNow")}
          </Button>
        )}
        {synced !== null && synced > 0 && (
          <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
            <Inbox className="h-3.5 w-3.5" /> {synced}
          </p>
        )}
      </div>

      <Button onClick={() => window.location.reload()} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        {t("tryAgain")}
      </Button>
    </div>
  );
}
