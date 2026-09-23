"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // In development the service worker is actively harmful: it keeps serving
    // the previous build's chunks, so after an edit the app renders the OLD UI
    // until something busts the caches by hand. That has already produced two
    // phantom bug hunts here (a "MISSING_MESSAGE" that was really a stale
    // chunk, and a chooser card that looked missing but was in the code). Heal
    // any worker a previous dev session left behind, then never register one.
    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
      if ("caches" in window) {
        void caches.keys().then((keys) => {
          for (const key of keys) void caches.delete(key);
        });
      }
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              toast("Update Available", {
                description: "A new version is available. Refresh to update.",
                action: {
                  label: "Refresh",
                  onClick: () => window.location.reload(),
                },
                duration: Infinity,
              });
            }
          });
        });
      })
      .catch((err) => {
        console.warn("SW registration failed:", err);
      });
  }, []);

  return null;
}
