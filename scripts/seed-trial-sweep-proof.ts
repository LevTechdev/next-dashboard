/**
 * Trial-sweep proof fixture: two throwaway users whose subscriptions exercise
 * both halves of runTrialSweep().
 *
 *   - trial-lapsed@example.com  → TRIALING Professional, ended yesterday
 *                                 (expect: CANCELED + a fresh ACTIVE Starter)
 *   - trial-soon@example.com    → TRIALING Professional, ends in ~2 days
 *                                 (expect: warning notification + email)
 *
 * Idempotent: re-running resets both fixtures to their starting state so the
 * sweep can be proven repeatedly.
 *
 * Usage: npx tsx scripts/seed-trial-sweep-proof.ts
 */
import { prisma } from "../src/lib/db";

const LAPSED_EMAIL = "trial-lapsed@example.com";
const SOON_EMAIL = "trial-soon@example.com";

async function ensureUser(email: string, name: string) {
  return prisma.user.upsert({
    where: { email },
    update: { isActive: true },
    create: {
      email,
      name,
      // Never signed in — this fixture only exercises the billing state machine.
      password: "unused-fixture-account",
      passwordAlgo: "argon2id",
      role: "ADMIN",
    },
  });
}

async function main() {
  const proPlan = await prisma.plan.findUnique({ where: { name: "Professional" } });
  const starterPlan = await prisma.plan.findUnique({ where: { name: "Starter" } });
  if (!proPlan || !starterPlan) {
    throw new Error("Plan catalogue missing Professional/Starter — run `npm run db:seed` first");
  }

  const lapsed = await ensureUser(LAPSED_EMAIL, "Lapsed Trial Owner");
  const soon = await ensureUser(SOON_EMAIL, "Ending-Soon Trial Owner");

  // Reset both fixtures: drop their subscriptions and any prior warning row.
  await prisma.subscription.deleteMany({ where: { userId: { in: [lapsed.id, soon.id] } } });
  await prisma.notification.deleteMany({
    where: { userId: { in: [lapsed.id, soon.id] }, type: "alert" },
  });

  const now = Date.now();
  await prisma.subscription.create({
    data: {
      userId: lapsed.id,
      planId: proPlan.id,
      status: "TRIALING",
      currentPeriodStart: new Date(now - 15 * 24 * 3600 * 1000),
      currentPeriodEnd: new Date(now - 24 * 3600 * 1000), // ended yesterday
    },
  });

  await prisma.subscription.create({
    data: {
      userId: soon.id,
      planId: proPlan.id,
      status: "TRIALING",
      currentPeriodStart: new Date(now - 12 * 24 * 3600 * 1000),
      currentPeriodEnd: new Date(now + 2 * 24 * 3600 * 1000), // ends in ~2 days
    },
  });

  console.log(
    JSON.stringify(
      {
        seeded: {
          lapsed: { userId: lapsed.id, email: lapsed.email },
          endingSoon: { userId: soon.id, email: soon.email },
        },
        proPlan: proPlan.name,
        starterPlan: starterPlan.name,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
