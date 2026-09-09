"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

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
