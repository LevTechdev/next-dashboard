"use client";

import { useCallback } from "react";
import posthog from "posthog-js";
import { useParams } from "next/navigation";

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean | undefined>;
}

/**
 * Locale-aware analytics hook that automatically attaches the current locale
 * to every event for EN vs ID conversion rate tracking.
 */
export function useAnalytics() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const capture = useCallback(
    (eventName: string, properties?: Record<string, string | number | boolean | undefined>) => {
      if (typeof window === "undefined" || !posthog.__loaded) return;

      posthog.capture(eventName, {
        locale,
        ...properties,
      });
    },
    [locale]
  );

  /**
   * Track a landing page conversion event (CTA click).
   */
  const trackCTA = useCallback(
    (ctaName: string, options?: { href?: string; isAuthenticated?: boolean }) => {
      capture("cta_clicked", {
        cta_name: ctaName,
        cta_href: options?.href,
        is_authenticated: options?.isAuthenticated ?? false,
        locale,
      });
    },
    [capture, locale]
  );

  /**
   * Track a feature card hover/interaction.
   */
  const trackFeatureInteraction = useCallback(
    (featureName: string) => {
      capture("feature_interaction", {
        feature: featureName,
        locale,
      });
    },
    [capture, locale]
  );

  /**
   * Track a language switch event.
   */
  const trackLanguageSwitch = useCallback(
    (fromLocale: string, toLocale: string) => {
      capture("language_switched", {
        from: fromLocale,
        to: toLocale,
      });
    },
    [capture]
  );

  /**
   * Track scroll depth — called when user scrolls past key milestones.
   */
  const trackScrollDepth = useCallback(
    (depth: number) => {
      capture("scroll_depth", {
        depth_percent: depth,
        locale,
      });
    },
    [capture, locale]
  );

  return {
    capture,
    trackCTA,
    trackFeatureInteraction,
    trackLanguageSwitch,
    trackScrollDepth,
    locale,
  };
}
