import { describe, it, expect } from "vitest";
import {
  tierFromPlanName,
  TIER_FEATURES,
  PLAN_TIER_RANK,
  FEATURE_REQUIRED_TIER,
} from "../plan-tiers";

/**
 * Pure-mapping tests for the subscription tier model. The DB-backed helpers
 * (getTierFeaturesForUser / assertTierFeature) are exercised through the API
 * route tests, which mock Prisma.
 */
describe("plan tiers", () => {
  it("maps plan names onto tiers", () => {
    expect(tierFromPlanName("Starter")).toBe("REGULAR");
    expect(tierFromPlanName("Professional")).toBe("PRO");
    expect(tierFromPlanName("Enterprise")).toBe("ENTERPRISE");
  });

  it("falls back to REGULAR for unknown or missing plan names", () => {
    expect(tierFromPlanName("Mystery Plan")).toBe("REGULAR");
    expect(tierFromPlanName(null)).toBe("REGULAR");
    expect(tierFromPlanName(undefined)).toBe("REGULAR");
  });

  it("orders tiers REGULAR < PRO < ENTERPRISE", () => {
    expect(PLAN_TIER_RANK.REGULAR).toBeLessThan(PLAN_TIER_RANK.PRO);
    expect(PLAN_TIER_RANK.PRO).toBeLessThan(PLAN_TIER_RANK.ENTERPRISE);
  });

  it("gates analytics/reports/multi-channel/api behind PRO", () => {
    expect(TIER_FEATURES.REGULAR.hasAnalytics).toBe(false);
    expect(TIER_FEATURES.REGULAR.hasReports).toBe(false);
    expect(TIER_FEATURES.REGULAR.hasMultiChannel).toBe(false);
    expect(TIER_FEATURES.REGULAR.hasApiAccess).toBe(false);
    expect(TIER_FEATURES.PRO.hasAnalytics).toBe(true);
    expect(TIER_FEATURES.PRO.hasReports).toBe(true);
    expect(TIER_FEATURES.PRO.hasMultiChannel).toBe(true);
    expect(TIER_FEATURES.PRO.hasApiAccess).toBe(true);
  });

  it("reserves custom exports for ENTERPRISE only", () => {
    expect(TIER_FEATURES.REGULAR.hasCustomExports).toBe(false);
    expect(TIER_FEATURES.PRO.hasCustomExports).toBe(false);
    expect(TIER_FEATURES.ENTERPRISE.hasCustomExports).toBe(true);
  });

  it("gives ENTERPRISE unlimited limits", () => {
    expect(TIER_FEATURES.ENTERPRISE.maxOrders).toBeNull();
    expect(TIER_FEATURES.ENTERPRISE.maxTeamMembers).toBeNull();
    expect(TIER_FEATURES.REGULAR.maxOrders).toBeGreaterThan(0);
    expect(TIER_FEATURES.PRO.maxOrders).toBeGreaterThan(TIER_FEATURES.REGULAR.maxOrders as number);
  });

  it("requires PRO for every standard feature and ENTERPRISE only for exports", () => {
    for (const [feature, tier] of Object.entries(FEATURE_REQUIRED_TIER)) {
      if (feature === "customExports") {
        expect(tier).toBe("ENTERPRISE");
      } else {
        expect(tier).toBe("PRO");
      }
    }
  });
});
