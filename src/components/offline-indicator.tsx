"use client";

import { useState, useEffect } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";

export function OfflineIndicator() {
  const t = useTranslations("pwa");
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 4000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999]"
        >
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-amber-500/90 text-amber-950 font-medium text-xs shadow-lg backdrop-blur-md border border-amber-400/50">
            <div className="flex items-center gap-2">
              <WifiOff className="h-3.5 w-3.5 animate-pulse" />
              <span>{t("offlineBanner")}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1 bg-amber-950/10 hover:bg-amber-950/20 px-2 py-0.5 rounded transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
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
            <span>{t("reconnectedBanner")}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
