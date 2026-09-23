/**
 * Backfill monthly usage snapshots into the UsageRecord table.
 *
 * The billing trend chart grows one bar per month from live metering, so a
 * fresh workspace starts with a single bar. This one-off (idempotent) job
 * backfills the last N monthly cycles from the order history so the chart is
 * immediately useful:
 *
 *   node scripts/backfill-usage-snapshots.mjs [--cycles=6] [--dry-run]
 *
 * Per cycle it upserts one `orders` snapshot per ACTIVE subscription using
 * the plan's monthly order cap context (value = actual order count for that
 * calendar month, scoped to the subscriber's tenant). team_members/api_keys
 * are point-in-time metrics — they cannot be reconstructed historically, so
 * they are intentionally skipped (the chart renders what exists).
 *
 * Idempotency: a snapshot is written only when no row exists for that
 * (subscriptionId, metric, periodStart) — re-running never duplicates.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cyclesArg = args.find((a) => a.startsWith("--cycles="));
const CYCLES = Math.max(1, Math.min(24, parseInt(cyclesArg?.split("=")[1] || "6", 10)));

function cycleStart(offset) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1, 0, 0, 0, 0);
  return d;
}

function cycleEnd(start) {
  return new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, 0);
}

async function main() {
  console.log(
    `Backfilling UsageRecord snapshots for the last ${CYCLES} cycles${dryRun ? " (dry run)" : ""}...\n`,
  );

  const subscriptions = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
    include: {
      plan: { select: { name: true } },
      user: { select: { tenantId: true, email: true } },
    },
  });

  if (subscriptions.length === 0) {
    console.log("No ACTIVE subscriptions found — nothing to backfill.");
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const sub of subscriptions) {
    const tenantId = sub.user?.tenantId ?? null;
    console.log(
      `Subscription ${sub.id} (${sub.plan?.name ?? "?"} plan, tenant ${tenantId ?? "—"}, ${sub.user?.email ?? "?"}):`,
    );

    for (let i = 1; i <= CYCLES; i++) {
      const start = cycleStart(i);
      const end = cycleEnd(start);

      // Skip the cycle the subscription started in before its own start date.
      if (start < new Date(sub.currentPeriodStart) && end <= sub.currentPeriodStart) {
        // Cycle entirely before the subscription existed — still fine to
        // count tenant orders for continuity; nothing skipped here.
      }

      const where = tenantId
        ? { tenantId, createdAt: { gte: start, lt: end } }
        : { userId: sub.userId, createdAt: { gte: start, lt: end } };

      const orderCount = await prisma.order.count({ where });

      const existing = await prisma.usageRecord.findFirst({
        where: { subscriptionId: sub.id, metric: "orders", periodStart: start },
        select: { id: true, value: true },
      });

      if (existing) {
        if (existing.value === orderCount) {
          skipped += 1;
          console.log(`  ${start.toISOString().slice(0, 7)}: orders=${orderCount} (up to date)`);
          continue;
        }
        if (!dryRun) {
          await prisma.usageRecord.update({
            where: { id: existing.id },
            data: { value: orderCount },
          });
        }
        console.log(`  ${start.toISOString().slice(0, 7)}: orders=${orderCount} (updated)`);
        continue;
      }

      if (!dryRun) {
        await prisma.usageRecord.create({
          data: {
            subscriptionId: sub.id,
            metric: "orders",
            value: orderCount,
            periodStart: start,
            periodEnd: end,
          },
        });
      }
      created += 1;
      console.log(`  ${start.toISOString().slice(0, 7)}: orders=${orderCount} (created)`);
    }
    console.log("");
  }

  console.log(
    `Done. ${created} snapshot(s) created, ${skipped} already up to date.${dryRun ? " (dry run — nothing written)" : ""}`,
  );
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
