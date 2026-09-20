/**
 * Backfill missing Starter subscriptions.
 *
 * Users created before the tier system (or via paths that skipped provisioning)
 * have no Subscription row — tier gating then falls back to REGULAR defaults,
 * which is correct, but billing/pages that join plans show nothing. This script
 * finds every active user without an ACTIVE subscription and provisions them
 * onto the Starter plan, exactly like signup does today.
 *
 * Run: node scripts/backfill-starter-subscriptions.mjs
 * (Uses DATABASE_URL from the environment / .env.local.)
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

// Load DATABASE_URL from .env.local when not present in the environment.
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(".env.local", "utf8");
    const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
    if (line)
      process.env.DATABASE_URL = line
        .replace("DATABASE_URL=", "")
        .replace(/^\"|\"$/g, "")
        .trim();
  } catch {
    // fall through — prisma will error with a clear message
  }
}

const prisma = new PrismaClient();

async function main() {
  const starter = await prisma.plan.findUnique({ where: { name: "Starter" } });
  if (!starter) {
    console.error("Starter plan not found — run the seed first (npm run db:seed).");
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, subscription: { select: { id: true, status: true } } },
  });

  // One-to-one relation: any ACTIVE subscription counts; non-ACTIVE rows are
  // replaced by the upsert below.
  const missing = users.filter((u) => !u.subscription || u.subscription.status !== "ACTIVE");
  console.log(`Users scanned: ${users.length}`);
  console.log(`Users missing an ACTIVE subscription: ${missing.length}`);

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  let created = 0;
  for (const user of missing) {
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        planId: starter.id,
        status: "ACTIVE",
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
      create: {
        userId: user.id,
        planId: starter.id,
        status: "ACTIVE",
        currentPeriodEnd: periodEnd,
      },
    });
    created += 1;
    if (process.argv.includes("--verbose")) {
      console.log(`  + provisioned ${user.email}`);
    }
  }

  console.log(`Backfilled ${created} user(s) onto the Starter plan.`);
  if (missing.length > 0 && created < missing.length) {
    console.warn(
      `${missing.length - created} user(s) could not be provisioned (see errors above).`,
    );
  }
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
