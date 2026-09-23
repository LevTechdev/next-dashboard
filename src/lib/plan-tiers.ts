import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Subscription tier model — maps billing plans onto dashboard capabilities.
 *
 * Tiers (per product spec):
 *   REGULAR    → Starter plan: core commerce only (orders/products/customers)
 *   PRO        → Professional plan: + analytics, reports, multi-channel, API
 *   ENTERPRISE → Enterprise plan: everything + custom data exports, RBAC, unlimited limits
 */
export type PlanTier = "REGULAR" | "PRO" | "ENTERPRISE";

export const PLAN_TIER_RANK: Record<PlanTier, number> = {
  REGULAR: 0,
  PRO: 1,
  ENTERPRISE: 2,
};

/**
 * Per-tier ceiling on simultaneously ACTIVE API keys.
 * null = unlimited. Consumed by POST /api/api-keys (402 gate) and
 * reported by GET /api/usage so the Billing page can meter it.
 */
export const API_KEY_LIMITS: Record<PlanTier, number | null> = {
  REGULAR: 2,
  PRO: 5,
  ENTERPRISE: null,
};

/** Plan.name → tier. Unknown plans fall back to REGULAR. */
const PLAN_NAME_TO_TIER: Record<string, PlanTier> = {
  Starter: "REGULAR",
  Professional: "PRO",
  Enterprise: "ENTERPRISE",
};

export interface TierFeatures {
  tier: PlanTier;
  planName: string;
  maxOrders: number | null;
  maxTeamMembers: number | null;
  hasAnalytics: boolean;
  hasReports: boolean;
  hasMultiChannel: boolean;
  hasApiAccess: boolean;
  hasRoleBasedAccess: boolean;
  hasCustomExports: boolean;
  supportLevel: string;
}

const REGULAR_FEATURES: TierFeatures = {
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
};

const PRO_FEATURES: TierFeatures = {
  tier: "PRO",
  planName: "Professional",
  maxOrders: 1000,
  maxTeamMembers: 10,
  hasAnalytics: true,
  hasReports: true,
  hasMultiChannel: true,
  hasApiAccess: true,
  hasRoleBasedAccess: true,
  hasCustomExports: false,
  supportLevel: "priority",
};

const ENTERPRISE_FEATURES: TierFeatures = {
  tier: "ENTERPRISE",
  planName: "Enterprise",
  maxOrders: null,
  maxTeamMembers: null,
  hasAnalytics: true,
  hasReports: true,
  hasMultiChannel: true,
  hasApiAccess: true,
  hasRoleBasedAccess: true,
  hasCustomExports: true,
  supportLevel: "dedicated",
};

export const TIER_FEATURES: Record<PlanTier, TierFeatures> = {
  REGULAR: REGULAR_FEATURES,
  PRO: PRO_FEATURES,
  ENTERPRISE: ENTERPRISE_FEATURES,
};

export function tierFromPlanName(planName: string | null | undefined): PlanTier {
  if (!planName) return "REGULAR";
  return PLAN_NAME_TO_TIER[planName] ?? "REGULAR";
}

function featuresFromPlan(plan: {
  name: string;
  maxOrders: number | null;
  maxTeamMembers: number | null;
  hasAnalytics: boolean;
  hasReports: boolean;
  hasMultiChannel: boolean;
  hasApiAccess: boolean;
  hasRoleBasedAccess: boolean;
  supportLevel: string;
}): TierFeatures {
  const tier = tierFromPlanName(plan.name);
  const base = TIER_FEATURES[tier];
  // Flags come from the plan row when present, tier defaults otherwise —
  // so plan edits in billing stay authoritative for their tier.
  return {
    tier,
    planName: plan.name,
    maxOrders: plan.maxOrders ?? base.maxOrders,
    maxTeamMembers: plan.maxTeamMembers ?? base.maxTeamMembers,
    hasAnalytics: plan.hasAnalytics || base.hasAnalytics,
    hasReports: plan.hasReports || base.hasReports,
    hasMultiChannel: plan.hasMultiChannel || base.hasMultiChannel,
    hasApiAccess: plan.hasApiAccess || base.hasApiAccess,
    hasRoleBasedAccess: plan.hasRoleBasedAccess || base.hasRoleBasedAccess,
    hasCustomExports: tier === "ENTERPRISE",
    supportLevel: plan.supportLevel || base.supportLevel,
  };
}

export const DEFAULT_TIER_FEATURES = REGULAR_FEATURES;

/**
 * Resolve the signed-in user's effective tier from their subscription.
 *
 * Both ACTIVE and unexpired TRIALING rows count: every new signup gets a
 * 14-day all-features PRO trial (see provisioning.ts), and the trial must
 * light up analytics/reports/API on day one. An EXPIRED trial (its
 * currentPeriodEnd in the past) is ignored, so the tier falls back to
 * Starter/REGULAR and the PRO gates re-close without any data migration.
 * Falls back to REGULAR when no qualifying subscription exists.
 */
export async function getTierFeaturesForUser(userId: string): Promise<TierFeatures> {
  const [subscription] = await Promise.all([
    prisma.subscription.findFirst({
      where: {
        userId,
        OR: [{ status: "ACTIVE" }, { status: "TRIALING", currentPeriodEnd: { gt: new Date() } }],
      },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!subscription) return DEFAULT_TIER_FEATURES;
  return featuresFromPlan(subscription.plan);
}

/**
 * Resolve the effective tier for a user inside a workspace (tenant).
 *
 * CLIENT / CLIENT_ENTERPRISE members don't own the subscription row — the
 * workspace owner (an ADMIN) does. Metering surfaces (GET /api/usage) use
 * this so a client sees the workspace's real plan limits rather than the
 * REGULAR default, making quota/upgrade status self-serve for clients.
 * Falls back to the user's own tier, then REGULAR.
 */
export async function getTierFeaturesForWorkspace(
  userId: string,
  tenantId: string | null | undefined,
): Promise<TierFeatures> {
  const own = await getTierFeaturesForUser(userId);
  if (own.tier !== "REGULAR" || !tenantId) return own;

  // No own subscription (or a plain Starter): the workspace owner's plan
  // governs the shared workspace resources.
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: { in: ["ADMIN"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!owner || owner.id === userId) return own;

  const ownerFeatures = await getTierFeaturesForUser(owner.id);
  // Take the more generous of the two so a client with their own upgrade
  // isn't downgraded by a Starter owner and vice versa.
  return PLAN_TIER_RANK[ownerFeatures.tier] > PLAN_TIER_RANK[own.tier] ? ownerFeatures : own;
}

export class TierUpgradeRequiredError extends Error {
  readonly requiredTier: PlanTier;
  readonly feature: FeatureKey;

  constructor(feature: FeatureKey, requiredTier: PlanTier) {
    super(`Feature "${feature}" requires the ${requiredTier} plan`);
    this.name = "TierUpgradeRequiredError";
    this.requiredTier = requiredTier;
    this.feature = feature;
  }
}

export type FeatureKey =
  "analytics" | "reports" | "multiChannel" | "api" | "rbac" | "customExports";

const FEATURE_FLAG: Record<FeatureKey, keyof TierFeatures> = {
  analytics: "hasAnalytics",
  reports: "hasReports",
  multiChannel: "hasMultiChannel",
  api: "hasApiAccess",
  rbac: "hasRoleBasedAccess",
  customExports: "hasCustomExports",
};

/** Minimum tier that unlocks each feature — used for upgrade CTAs. */
export const FEATURE_REQUIRED_TIER: Record<FeatureKey, PlanTier> = {
  analytics: "PRO",
  reports: "PRO",
  multiChannel: "PRO",
  api: "PRO",
  rbac: "PRO",
  customExports: "ENTERPRISE",
};

/**
 * Server-side feature gate. Throws TierUpgradeRequiredError when the user's
 * tier lacks the feature; callers turn that into a 402 with upgrade hints.
 */
export async function assertTierFeature(
  userId: string,
  feature: FeatureKey,
): Promise<TierFeatures> {
  const features = await getTierFeaturesForUser(userId);
  const flag = FEATURE_FLAG[feature];
  if (features[flag] !== true) {
    throw new TierUpgradeRequiredError(feature, FEATURE_REQUIRED_TIER[feature]);
  }
  return features;
}

/** Wraps a JSON response with 402 + machine-readable upgrade payload. */
export function tierUpgradeResponse(error: TierUpgradeRequiredError) {
  return new Response(
    JSON.stringify({
      error: "upgrade_required",
      feature: error.feature,
      requiredTier: error.requiredTier,
      currentFeatures: null,
    }),
    { status: 402, headers: { "content-type": "application/json" } },
  );
}

/** Prisma-compatible passthrough for typed subscription includes. */
export type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: { plan: true };
}>;
