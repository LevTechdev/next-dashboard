"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
      <div className="p-6 rounded-2xl bg-gray-100 dark:bg-gray-800/60 mb-6">
        <WifiOff className="h-16 w-16 text-gray-400 dark:text-gray-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">You're Offline</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm mb-6">
        It looks like you've lost your internet connection. Some features may be unavailable until you reconnect.
      </p>
      <Button onClick={() => window.location.reload()} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}
