"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useAuth, type TierFeaturesClient } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rocket, Check } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Client-side subscription tier gate — the UI mirror of src/lib/plan-tiers.ts.
 *
 * `useTier()` exposes the signed-in user's effective plan features (from
 * /api/auth/me) plus `can(feature)` and `requireUpgrade(feature)` helpers.
 * The rendered dialog is a Sora-style upgrade prompt with a tier comparison
 * and a CTA into the billing page. All copy is localized.
 */
export type FeatureKeyClient =
  | "analytics"
  | "reports"
  | "multiChannel"
  | "api"
  | "rbac"
  | "customExports"
  | "orderLimit"
  | "seatLimit";

const REQUIRED_TIER: Record<FeatureKeyClient, "PRO" | "ENTERPRISE"> = {
  analytics: "PRO",
  reports: "PRO",
  multiChannel: "PRO",
  api: "PRO",
  rbac: "PRO",
  customExports: "ENTERPRISE",
  orderLimit: "PRO",
  seatLimit: "PRO",
};

const FEATURE_LABEL_KEY: Record<FeatureKeyClient, string> = {
  analytics: "featureAnalytics",
  reports: "featureReports",
  multiChannel: "featureMultiChannel",
  api: "featureApi",
  rbac: "featureRbac",
  customExports: "featureCustomExports",
  orderLimit: "featureOrderLimit",
  seatLimit: "featureSeatLimit",
};

export function useTier() {
  const { user } = useAuth();
  const features: TierFeaturesClient = useMemo(
    () =>
      user?.tier ?? {
        tier: "REGULAR",
        planName: "Starter",
        maxOrders: 100,
        maxTeamMembers: 3,
        hasAnalytics: false,
        hasReports: false,
        hasMultiChannel: false,
        hasApiAccess: false,
        hasRoleBasedAccess: false,
        hasCustomExports: false,
        supportLevel: "email",
      },
    [user?.tier],
  );

  const can = useCallback(
    (feature: FeatureKeyClient) => {
      // The orders/seat gates are volume caps, not boolean flags — "can"
      // means the cap is lifted (null = unlimited, PRO+/Enterprise).
      if (feature === "orderLimit") return features.maxOrders === null;
      if (feature === "seatLimit") return features.maxTeamMembers === null;
      const flag = {
        analytics: "hasAnalytics",
        reports: "hasReports",
        multiChannel: "hasMultiChannel",
        api: "hasApiAccess",
        rbac: "hasRoleBasedAccess",
        customExports: "hasCustomExports",
      }[feature] as keyof TierFeaturesClient;
      return features[flag] === true;
    },
    [features],
  );

  const isUpgradeRequired = useCallback((feature: FeatureKeyClient) => !can(feature), [can]);

  return { features, can, isUpgradeRequired };
}

interface UpgradeDialogState {
  open: boolean;
  feature: FeatureKeyClient | null;
}

export function TierUpgradeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UpgradeDialogState>({ open: false, feature: null });
  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "en";
  const t = useTranslations("tierUpgrade");

  const showUpgrade = useCallback((feature: FeatureKeyClient) => {
    setState({ open: true, feature });
  }, []);

  const close = useCallback(() => setState({ open: false, feature: null }), []);

  return (
    <TierUpgradeContext.Provider value={showUpgrade}>
      {children}
      <Dialog open={state.open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Rocket className="h-5 w-5" />
            </div>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>
              {state.feature
                ? t("description", {
                    feature: t(FEATURE_LABEL_KEY[state.feature]),
                    tier:
                      REQUIRED_TIER[state.feature as FeatureKeyClient] === "ENTERPRISE"
                        ? t("planEnterprise")
                        : t("planPro"),
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-2xl border border-border/70 p-3">
            {(["PRO", "ENTERPRISE"] as const).map((tier) => (
              <div key={tier} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-3 w-3" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    {tier === "PRO" ? t("planPro") : t("planEnterprise")}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {tier === "PRO" ? t("planProDesc") : t("planEnterpriseDesc")}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={close}>
              {t("notNow")}
            </Button>
            <Button size="sm" className="gap-1.5" asChild>
              <Link href={`/${locale}/billing?tab=plans`}>{t("viewPlans")}</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TierUpgradeContext.Provider>
  );
}

const TierUpgradeContext = createContext<(feature: FeatureKeyClient) => void>(() => {
  // No provider mounted — no-op keeps callers safe.
});

/** Opens the shared upgrade dialog for a gated feature. */
export function useShowUpgrade() {
  return useContext(TierUpgradeContext);
}
