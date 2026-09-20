"server-only";

import { prisma } from "@/lib/db";

/** Length of the all-features PRO trial granted to every new signup. */
export const TRIAL_DAYS = 14;
export const TRIAL_PLAN_NAME = "Professional";

/**
 * Provision an empty personal workspace for a self-service signup.
 *
 * Dropping new users into the shared `default` tenant made every fresh
 * account see the seed workspace's revenue/orders/customers — data that does
 * not belong to them. A personal tenant guarantees a clean dashboard: all
 * dashboard aggregates are tenant-scoped, so an empty tenant renders $0 / 0
 * across revenue, profit, orders, customers, and products.
 *
 * Falls back to the default tenant only if provisioning fails, so a tenant
 * insert hiccup can never block account creation.
 */
export async function provisionPersonalTenant(userName: string): Promise<string | null> {
  const fallback = await prisma.tenant.findUnique({
    where: { slug: "default" },
    select: { id: true },
  });
  try {
    const suffix = Math.random().toString(36).slice(2, 8);
    const workspace = await prisma.tenant.create({
      data: {
        name: `${userName}'s Workspace`,
        slug: `ws-${suffix}`,
      },
      select: { id: true },
    });
    return workspace.id;
  } catch (err) {
    console.error("[provision] personal tenant creation failed; using default:", err);
    return fallback?.id ?? null;
  }
}

/**
 * Ensure every newly provisioned user lands with a subscription — the exact
 * same onboarding data the email/password register route creates. Shared by
 * the register route and the OAuth/SAML JIT-provisioning paths so social
 * signups get identical tier data instead of a bare User row.
 *
 * New signups get a **14-day all-features PRO trial**: the subscription row
 * is TRIALING on the Professional plan, and tier resolution counts an
 * unexpired trial as PRO. When the trial lapses the tier falls back to
 * Starter (REGULAR) — analytics/reports/API gate themselves again without a
 * data migration.
 */
export async function ensureStarterSubscription(userId: string): Promise<void> {
  const existing = await prisma.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "TRIALING"] } },
    select: { id: true },
  });
  if (existing) return;

  const trialPlan =
    (await prisma.plan.findUnique({ where: { name: TRIAL_PLAN_NAME } })) ??
    (await prisma.plan.findUnique({ where: { name: "Starter" } }));
  if (!trialPlan) {
    // Plan catalogue missing (unseeded DB) — the user still works with the
    // REGULAR-tier fallback in plan-tiers.ts.
    console.warn(
      `[provision] No ${TRIAL_PLAN_NAME}/Starter plan; user ${userId} stays on tier defaults`,
    );
    return;
  }

  const periodEnd = new Date();
  if (trialPlan.name === TRIAL_PLAN_NAME) {
    periodEnd.setDate(periodEnd.getDate() + TRIAL_DAYS);
    await prisma.subscription.create({
      data: {
        userId,
        planId: trialPlan.id,
        status: "TRIALING",
        currentPeriodEnd: periodEnd,
      },
    });
    return;
  }

  // Starter fallback (no Professional plan in the catalogue): plain ACTIVE.
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await prisma.subscription.create({
    data: {
      userId,
      planId: trialPlan.id,
      status: "ACTIVE",
      currentPeriodEnd: periodEnd,
    },
  });
}
