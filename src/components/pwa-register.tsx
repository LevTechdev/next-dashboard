"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    // Skip service worker registration in development to avoid stale chunk caching
    if (process.env.NODE_ENV === "development") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("PWA Service Worker registered:", registration.scope);
        })
        .catch((error) => {
          console.log("PWA Service Worker registration failed:", error);
        });
    }
  }, []);

  return null;
}
