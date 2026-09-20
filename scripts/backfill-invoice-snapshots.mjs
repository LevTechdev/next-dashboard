/**
 * One-time backfill: freeze the issue-time invoiceSnapshot on every invoice
 * that predates snapshots.
 *
 * Invoices issued before `snapshotJson` existed render from live plan/FX data,
 * so a later price change silently rewrites their history. This job writes the
 * snapshot those rows should have been born with:
 *
 *   node scripts/backfill-invoice-snapshots.mjs [--dry-run]
 *
 * The shape matches src/lib/invoice-snapshot.ts byte for byte (version 1,
 * 89/11 subtotal/tax split), with one important difference: `issuedAt` is the
 * invoice's own createdAt — the ISSUE time — not the moment the backfill runs,
 * so reprints stay faithful to when the invoice was actually issued.
 *
 * Idempotent: only rows whose snapshotJson is NULL are touched, so re-running
 * never rewrites a genuine (or previously backfilled) snapshot.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const dryRun = process.argv.includes("--dry-run");
const TAX_SPLIT = 0.89; // subtotal share; tax = amount − subtotal (11% VAT)

const iso = (d) => (d ? new Date(d).toISOString() : null);

/** Same shape as buildInvoiceSnapshot(), pinned to the invoice's issue time. */
function buildSnapshot(invoice) {
  const plan = invoice.plan;
  return {
    version: 1,
    issuedAt: iso(invoice.createdAt),
    plan: plan
      ? {
          name: plan.name,
          interval: plan.interval,
          price: plan.price,
          yearlyPrice: plan.yearlyPrice ?? null,
        }
      : { name: null, interval: null, price: null, yearlyPrice: null },
    amount: invoice.amount,
    currency: invoice.currency,
    subtotal: Number((invoice.amount * TAX_SPLIT).toFixed(2)),
    tax: Number((invoice.amount - invoice.amount * TAX_SPLIT).toFixed(2)),
    description: invoice.description ?? null,
    periodStart: iso(invoice.periodStart),
    periodEnd: iso(invoice.periodEnd),
  };
}

async function main() {
  console.log(`Backfilling issue-time invoice snapshots${dryRun ? " (dry run)" : ""}...\n`);

  const invoices = await prisma.invoice.findMany({
    include: { plan: true },
    orderBy: { createdAt: "asc" },
  });
  const missing = invoices.filter(
    (invoice) => invoice.snapshotJson === null || invoice.snapshotJson === undefined,
  );

  console.log(`Invoices: ${invoices.length} total — ${missing.length} without a frozen snapshot.`);

  if (missing.length === 0) {
    console.log("\nNothing to backfill: every invoice already carries an issue-time snapshot.");
    return;
  }

  let frozen = 0;
  let failed = 0;
  const byStatus = new Map();

  for (const invoice of missing) {
    if (dryRun) {
      frozen += 1;
      byStatus.set(invoice.status, (byStatus.get(invoice.status) ?? 0) + 1);
      console.log(
        `  ~ ${invoice.invoiceNumber}  ${invoice.status.padEnd(9)} ${invoice.currency} ${invoice.amount}  (issued ${invoice.createdAt.toISOString()})`,
      );
      continue;
    }
    try {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { snapshotJson: buildSnapshot(invoice) },
      });
      frozen += 1;
      byStatus.set(invoice.status, (byStatus.get(invoice.status) ?? 0) + 1);
    } catch (err) {
      failed += 1;
      console.error(`  ! ${invoice.invoiceNumber}: ${err?.message ?? err}`);
    }
  }

  console.log(
    `\nFrozen ${frozen} invoice(s)${dryRun ? " (dry run — nothing written)" : ""}` +
      `${failed ? `, ${failed} failed` : ""}.`,
  );
  if (byStatus.size > 0) {
    console.log(
      "By status: " + [...byStatus.entries()].map(([status, n]) => `${status}=${n}`).join(", "),
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
