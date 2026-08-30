"use client";

import { useCallback, useEffect, useState } from "react";

export type AccentKey = "default" | "green" | "indigo" | "rose" | "amber" | "custom";
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
  customColor?: string;
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

export function hexToHsl(hex: string): string {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((x) => x + x).join("");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Apply settings as data attributes on <html> (consumed by globals.css). */
export function applyAppearance(settings: AppearanceSettings) {
  const root = document.documentElement;
  
  // Helper to remove custom properties
  const removeCustomProps = () => {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--ai-accent");
    root.style.removeProperty("--ai-accent-strong");
    root.style.removeProperty("--ai-accent-soft");
    root.style.removeProperty("--ai-accent-soft-2");
  };

  if (settings.accent === "default") {
    delete root.dataset.accent;
    removeCustomProps();
  } else if (settings.accent === "custom" && settings.customColor) {
    root.dataset.accent = "custom";
    const hsl = hexToHsl(settings.customColor);
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
    
    // Parse HSL to adjust lightness for AI variants
    const [h, s, lStr] = hsl.split(" ");
    const l = parseInt(lStr);
    
    // AI Accent uses the primary color
    root.style.setProperty("--ai-accent", hsl);
    
    // Strong is slightly darker
    const strongL = Math.max(0, l - 12);
    root.style.setProperty("--ai-accent-strong", `${h} ${s} ${strongL}%`);
    
    // Soft is very light for backgrounds
    const softL = Math.min(95, l + 40);
    root.style.setProperty("--ai-accent-soft", `${h} ${s} ${softL}%`);
    
    // Soft 2 is even lighter
    const soft2L = Math.min(97, l + 45);
    root.style.setProperty("--ai-accent-soft-2", `${h} ${s} ${soft2L}%`);
  } else {
    root.dataset.accent = settings.accent;
    removeCustomProps();
  }
  
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
