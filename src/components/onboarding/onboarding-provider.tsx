"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface OnboardingStep {
  id: string;
  labelKey: string;  // i18n key
  descKey: string;   // i18n key
  href: string;      // link to the relevant page
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

const STORAGE_KEY = "onboarding-state";
const DISMISS_KEY = "onboarding-dismissed";

const DEFAULT_STEPS: OnboardingStep[] = [
  { id: "add-product", labelKey: "stepAddProduct", descKey: "stepAddProductDesc", href: "/products", completed: false },
  { id: "create-order", labelKey: "stepCreateOrder", descKey: "stepCreateOrderDesc", href: "/orders", completed: false },
  { id: "invite-member", labelKey: "stepInviteMember", descKey: "stepInviteMemberDesc", href: "/team", completed: false },
  { id: "configure-notifications", labelKey: "stepConfigNotifs", descKey: "stepConfigNotifsDesc", href: "/notifications", completed: false },
  { id: "customize-appearance", labelKey: "stepCustomize", descKey: "stepCustomizeDesc", href: "/settings", completed: false },
];

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [steps, setSteps] = useState<OnboardingStep[]>(DEFAULT_STEPS);
  const [isDismissed, setIsDismissed] = useState(true); // Start true to prevent flash

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (saved) {
        const completedIds: string[] = JSON.parse(saved);
        setSteps(prev => prev.map(s => ({ ...s, completed: completedIds.includes(s.id) })));
      }
      setIsDismissed(dismissed === "true");
    } catch {}
  }, []);

  const completeStep = useCallback((id: string) => {
    setSteps(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, completed: true } : s);
      const completedIds = updated.filter(s => s.completed).map(s => s.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completedIds));
      return updated;
    });
  }, []);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(DISMISS_KEY, "true");
  }, []);

  const reset = useCallback(() => {
    setSteps(DEFAULT_STEPS);
    setIsDismissed(false);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DISMISS_KEY);
  }, []);

  const completedCount = steps.filter(s => s.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const isComplete = completedCount === steps.length;

  return (
    <OnboardingContext.Provider value={{ steps, completeStep, progress, dismiss, isDismissed, isComplete, reset }}>
      {children}
    </OnboardingContext.Provider>
  );
}
