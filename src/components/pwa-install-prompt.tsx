"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share2, PlusSquare, Smartphone, Laptop } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const t = useTranslations("pwa");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem("pwa-install-dismissed");
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    setIsIosDevice(isIOS);

    if (isStandalone) return;

    if (isIOS) {
      if (!isDismissed) {
        setTimeout(() => setShowPrompt(true), 4000);
      }
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!isDismissed) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Also listen for manual "open-pwa-install" triggers
    const manualHandler = () => {
      if (isIOS) {
        setShowIosGuide(true);
      } else if (deferredPrompt) {
        deferredPrompt.prompt();
      } else {
        setShowPrompt(true);
      }
    };
    window.addEventListener("open-pwa-install", manualHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("open-pwa-install", manualHandler);
    };
  }, [deferredPrompt]);

  const handleInstall = useCallback(async () => {
    if (isIosDevice) {
      setShowIosGuide(true);
      setShowPrompt(false);
      return;
    }

    if (!deferredPrompt) {
      setShowPrompt(false);
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt, isIosDevice]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "true");
  }, []);

  return (
    <>
      {showPrompt && !dismissed && (
        <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80 animate-in fade-in slide-in-from-bottom-5">
          <div className="rounded-xl border border-indigo-500/30 bg-card p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  {isIosDevice ? (
                    <Smartphone className="h-5 w-5" />
                  ) : (
                    <Laptop className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("installTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("installSubtitle")}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handleDismiss}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                onClick={handleInstall}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {isIosDevice ? t("howToInstall") : t("installButton")}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDismiss}>
                {t("later")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Safari Installation Guide Modal */}
      <Dialog open={showIosGuide} onOpenChange={setShowIosGuide}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-indigo-500" />
              {t("iosTitle")}
            </DialogTitle>
            <DialogDescription>{t("iosSubtitle")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white font-bold text-xs">
                1
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  {t("iosStep1Title")}
                  <Share2 className="h-3.5 w-3.5 text-indigo-500 inline" />
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("iosStep1Desc")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white font-bold text-xs">
                2
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  {t("iosStep2Title")}
                  <PlusSquare className="h-3.5 w-3.5 text-indigo-500 inline" />
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("iosStep2Desc")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white font-bold text-xs">
                3
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{t("iosStep3Title")}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("iosStep3Desc")}</p>
              </div>
            </div>

            <Button className="w-full mt-2" onClick={() => setShowIosGuide(false)}>
              {t("gotIt")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
