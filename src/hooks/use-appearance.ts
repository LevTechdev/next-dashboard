"use client";

import { useCallback, useEffect, useState } from "react";

export type AccentKey = "default" | "green" | "indigo" | "rose" | "amber";
export type TextSizeKey = "sm" | "base" | "lg";
export type DensityKey = "compact" | "regular" | "large";

export interface WidgetVisibility {
  quickActions: boolean;
  revenueChart: boolean;
  salesByChannel: boolean;
  recentOrders: boolean;
  topProducts: boolean;
}

export interface AppearanceSettings {
  accent: AccentKey;
  textSize: TextSizeKey;
  density: DensityKey;
  widgets: WidgetVisibility;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  accent: "default",
  textSize: "base",
  density: "regular",
  widgets: {
    quickActions: true,
    revenueChart: true,
    salesByChannel: true,
    recentOrders: true,
    topProducts: true,
  },
};

const STORAGE_KEY = "dashboard-appearance";

export function loadAppearance(): AppearanceSettings {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
    return {
      ...DEFAULT_APPEARANCE,
      ...parsed,
      widgets: { ...DEFAULT_APPEARANCE.widgets, ...(parsed.widgets ?? {}) },
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Apply settings as data attributes on <html> (consumed by globals.css). */
export function applyAppearance(settings: AppearanceSettings) {
  const root = document.documentElement;
  if (settings.accent === "default") delete root.dataset.accent;
  else root.dataset.accent = settings.accent;
  if (settings.textSize === "base") delete root.dataset.text;
  else root.dataset.text = settings.textSize;
  if (settings.density === "regular") delete root.dataset.density;
  else root.dataset.density = settings.density;
}

export function saveAppearance(settings: AppearanceSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  applyAppearance(settings);
  window.dispatchEvent(new CustomEvent("appearance-changed"));
}

export function useAppearance() {
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(loadAppearance()); // eslint-disable-line react-hooks/set-state-in-effect
    setLoaded(true);
    const onChange = () => setSettings(loadAppearance());
    window.addEventListener("appearance-changed", onChange);
    return () => window.removeEventListener("appearance-changed", onChange);
  }, []);

  const update = useCallback((patch: Partial<AppearanceSettings>) => {
    setSettings((prev) => {
      const next: AppearanceSettings = {
        ...prev,
        ...patch,
        widgets: { ...prev.widgets, ...(patch.widgets ?? {}) },
      };
      saveAppearance(next);
      return next;
    });
  }, []);

  return { settings, update, loaded };
}
