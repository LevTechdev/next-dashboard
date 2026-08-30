"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or on iOS (no prompt support)
    const isDismissed = localStorage.getItem("pwa-install-dismissed");
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isDismissed || isStandalone || isIOS) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after a short delay so it doesn't appear immediately
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "true");
  }, []);

  if (!showPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80">
      <div className="rounded-xl border bg-card p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Install Dashboard</p>
              <p className="text-xs text-muted-foreground">
                Add to your home screen for quick access
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleDismiss}>
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" onClick={handleInstall}>
            Install
          </Button>
          <Button size="sm" variant="outline" onClick={handleDismiss}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
