"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ActivityIcon, RefreshCwIcon } from "lucide-animated";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface RealtimeIndicatorProps {
  lastUpdated: Date | null;
  isRefreshing?: boolean;
  error?: Error | null;
  className?: string;
}

export function RealtimeIndicator({
  lastUpdated,
  isRefreshing = false,
  error = null,
  className,
}: RealtimeIndicatorProps) {
  const t = useTranslations("common");
  const [timeAgo, setTimeAgo] = useState<string>("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    if (!lastUpdated) {
      setTimeAgo("");
      return;
    }

    const updateTimeAgo = () => {
      const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (seconds < 5) setTimeAgo(t("justNow"));
      else if (seconds < 60) setTimeAgo(t("secondsAgo", { count: seconds }));
      else if (seconds < 3600) setTimeAgo(t("minutesAgo", { count: Math.floor(seconds / 60) }));
      else setTimeAgo(t("hoursAgo", { count: Math.floor(seconds / 3600) }));
    };

    updateTimeAgo();
    const intervalId = setInterval(updateTimeAgo, 5000);
    return () => clearInterval(intervalId);
  }, [lastUpdated, t]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setPopoverOpen((prev) => !prev)}
      onKeyDown={(e) => e.key === "Enter" && setPopoverOpen((prev) => !prev)}
      className={cn(
        "relative inline-flex items-center gap-2 text-xs transition-all duration-300 cursor-pointer select-none rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/60 p-0.5",
        error ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      {error ? (
        <WifiOff className="h-3 w-3" />
      ) : isRefreshing ? (
        <RefreshCwIcon size={12} className="h-3 w-3 animate-spin" />
      ) : (
        <ActivityIcon size={12} className="h-3 w-3" />
      )}
      <span className="font-medium">
        {error
          ? t("realtimeDisconnected")
          : isRefreshing
            ? t("realtimeUpdating")
            : `${t("realtimeLive")}${timeAgo ? ` • ${t("updatedAgo", { time: timeAgo })}` : ""}`}
      </span>

      {popoverOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopoverOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-50 w-60 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-md text-xs text-foreground animate-in fade-in-50 duration-150">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Connection Health
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                OPTIMAL
              </span>
            </div>
            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Protocol:</span>
                <span className="font-mono text-foreground">WebSocket / SSE</span>
              </div>
              <div className="flex justify-between">
                <span>Last Synchronized:</span>
                <span className="font-mono text-foreground">
                  {lastUpdated ? lastUpdated.toLocaleTimeString() : "Pending"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Feed Status:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {error ? "Disconnected" : isRefreshing ? "Syncing..." : "Live Active"}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
