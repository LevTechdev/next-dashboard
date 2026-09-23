"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

interface OnboardingStep {
  id: string;
  labelKey: string; // i18n key
  descKey: string; // i18n key
  href: string; // link to the relevant page
  completed: boolean;
}

interface OnboardingContextValue {
  steps: OnboardingStep[];
  completeStep: (id: string) => void;
  progress: number; // 0-100
  dismiss: () => void;
  isDismissed: boolean;
  isComplete: boolean;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}

/**
 * Per-user storage keys. The checklist state used to live under two GLOBAL
 * keys — one workspace-wide dismissal hid onboarding from every later user
 * on the same browser, which is exactly why fresh accounts "never see it".
 * Keying by user id scopes dismissals/completions to that account.
 */
const storageKeys = (userId: string | null | undefined) =>
  userId ? ([`onboarding-state:${userId}`, `onboarding-dismissed:${userId}`] as const) : null;

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: "add-product",
    labelKey: "stepAddProduct",
    descKey: "stepAddProductDesc",
    href: "/products",
    completed: false,
  },
  {
    id: "create-order",
    labelKey: "stepCreateOrder",
    descKey: "stepCreateOrderDesc",
    href: "/orders",
    completed: false,
  },
  {
    id: "invite-member",
    labelKey: "stepInviteMember",
    descKey: "stepInviteMemberDesc",
    href: "/settings/team",
    completed: false,
  },
  {
    id: "configure-notifications",
    labelKey: "stepConfigNotifs",
    descKey: "stepConfigNotifsDesc",
    href: "/notifications",
    completed: false,
  },
  {
    id: "customize-appearance",
    labelKey: "stepCustomize",
    descKey: "stepCustomizeDesc",
    href: "/settings",
    completed: false,
  },
];

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [steps, setSteps] = useState<OnboardingStep[]>(DEFAULT_STEPS);
  const [isDismissed, setIsDismissed] = useState(true); // Start true to prevent flash

  // Load state from localStorage once the signed-in user is known. Before
  // that the checklist stays hidden (dismissed) — no flash for logged-out or
  // loading states, and the keys are stable per account.
  useEffect(() => {
    if (isLoading) return;
    const keys = storageKeys(user?.id);
    if (!keys) {
      // Signed out — keep hidden; the dashboard layout won't render it anyway.
      setIsDismissed(true);
      return;
    }
    try {
      const [storageKey, dismissKey] = keys;
      const saved = localStorage.getItem(storageKey);
      const dismissed = localStorage.getItem(dismissKey);
      if (saved) {
        const completedIds: string[] = JSON.parse(saved);
        setSteps((prev) => prev.map((s) => ({ ...s, completed: completedIds.includes(s.id) })));
      } else {
        setSteps(DEFAULT_STEPS);
      }
      setIsDismissed(dismissed === "true");
    } catch {}
  }, [user?.id, isLoading]);

  const completeStep = useCallback(
    (id: string) => {
      setSteps((prev) => {
        const updated = prev.map((s) => (s.id === id ? { ...s, completed: true } : s));
        const keys = storageKeys(user?.id);
        if (keys) {
          const completedIds = updated.filter((s) => s.completed).map((s) => s.id);
          localStorage.setItem(keys[0], JSON.stringify(completedIds));
        }
        return updated;
      });
    },
    [user?.id],
  );

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    const keys = storageKeys(user?.id);
    if (keys) localStorage.setItem(keys[1], "true");
  }, [user?.id]);

  const reset = useCallback(() => {
    setSteps(DEFAULT_STEPS);
    setIsDismissed(false);
    const keys = storageKeys(user?.id);
    if (keys) {
      localStorage.removeItem(keys[0]);
      localStorage.removeItem(keys[1]);
    }
  }, [user?.id]);

  const completedCount = steps.filter((s) => s.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const isComplete = completedCount === steps.length;

  return (
    <OnboardingContext.Provider
      value={{ steps, completeStep, progress, dismiss, isDismissed, isComplete, reset }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
