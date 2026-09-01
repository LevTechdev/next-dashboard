"use client";

import { useState, useEffect } from "react";
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
  const [timeAgo, setTimeAgo] = useState<string>("");

  useEffect(() => {
    if (!lastUpdated) {
      setTimeAgo("");
      return;
    }

    const updateTimeAgo = () => {
      const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (seconds < 5) setTimeAgo("Just now");
      else if (seconds < 60) setTimeAgo(`${seconds}s ago`);
      else if (seconds < 3600) setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
      else setTimeAgo(`${Math.floor(seconds / 3600)}h ago`);
    };

    updateTimeAgo();
    const intervalId = setInterval(updateTimeAgo, 5000);
    return () => clearInterval(intervalId);
  }, [lastUpdated]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs transition-all duration-300",
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
          ? "Disconnected"
          : isRefreshing
            ? "Updating..."
            : `Live${timeAgo ? ` • Updated ${timeAgo}` : ""}`}
      </span>
    </div>
  );
}
