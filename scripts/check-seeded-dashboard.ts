/**
 * Seeded-dashboard integrity check (CI step + local).
 *
 * Fails when a FRESH seed produces tenant-scoped rows but the dashboard would
 * show zeros — the bug class where prisma/seed.ts creates orders/customers/
 * products/etc. WITHOUT a tenantId while every tenant-scoped API route (e.g.
 * /api/dashboard) filters by `where: { tenantId }`.
 *
 * Also fails when the seed writes ANY SecurityEvent or ActivityLog row with a
 * NULL tenantId — those rows belong to nobody under the strict audit-read
 * scoping, so the seed's demo activity logs must carry the default tenant id.
 *
 * Instead of importing prisma/seed.ts (which calls main() at module scope and
 * would WIPE + re-seed the DB on import), this script hardcodes the seed's
 * canonical constants and replicates the EXACT tenant-scoped queries from
 * src/app/api/dashboard/route.ts — so a seed regression fails here in seconds,
 * without a browser or a dev server. The browser-level assertion (real API,
 * real UI) lives in e2e/dashboard-seeded-data.spec.ts and rides the same CI
 * workflow.
 *
 * Run:  npm run check:seed   (expects a freshly seeded DB)
 *       npm run db:seed && npm run check:seed
 */
import { PrismaClient } from "@prisma/client";

/** Mirrors prisma/seed.ts's default workspace + seed admin. */
const DEFAULT_TENANT_SLUG = "default";
const SEED_ADMIN_EMAIL = "nextdashboards@gmail.com";

const prisma = new PrismaClient();

const failures: string[] = [];

function check(label: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`  [PASS] ${label}`);
  } else {
    console.log(`  [FAIL] ${label} — ${JSON.stringify(detail)}`);
    failures.push(label);
  }
}

async function main(): Promise<void> {
  console.log("🔎 Checking seeded data against the /api/dashboard contract…");

  const tenant = await prisma.tenant.findUnique({ where: { slug: DEFAULT_TENANT_SLUG } });
  check(`default tenant "${DEFAULT_TENANT_SLUG}" exists`, Boolean(tenant));
  if (!tenant) {
    console.error("\n❌ Default tenant missing — run `npm run db:seed` first.");
    process.exit(1);
  }

  const admin = await prisma.user.findUnique({ where: { email: SEED_ADMIN_EMAIL } });
  check(`seed admin ${SEED_ADMIN_EMAIL} exists`, Boolean(admin));
  check("seed admin belongs to the default tenant", admin?.tenantId === tenant.id, admin?.tenantId);

  // Replicate /api/dashboard's tenant-scoped queries exactly (same where
  // clauses, includes, ordering, take limits). If the seed's rows lack
  // tenantId, every one of these comes back empty / zero.
  const [totalRevenue, totalOrders, totalCustomers, totalProducts, recentOrders, topProducts] =
    await Promise.all([
      prisma.order.aggregate({ where: { tenantId: tenant.id }, _sum: { grandTotal: true } }),
      prisma.order.count({ where: { tenantId: tenant.id } }),
      prisma.customer.count({ where: { tenantId: tenant.id } }),
      prisma.product.count({ where: { isActive: true, tenantId: tenant.id } }),
      prisma.order.findMany({
        where: { tenantId: tenant.id },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { customer: true, channel: true },
      }),
      prisma.product.findMany({
        where: { tenantId: tenant.id },
        take: 5,
        orderBy: { orderItems: { _count: "desc" } },
        include: { _count: { select: { orderItems: true, affiliateLinks: true } } },
      }),
    ]);

  const revenue = totalRevenue._sum.grandTotal ?? 0;
  check("totalRevenue > 0 (dashboard revenue card)", revenue > 0, revenue);
  check("totalOrders > 0", totalOrders > 0, totalOrders);
  check("totalCustomers > 0", totalCustomers > 0, totalCustomers);
  check("totalProducts > 0", totalProducts > 0, totalProducts);
  check("recentOrders non-empty", recentOrders.length > 0, recentOrders.length);
  check("topProducts non-empty", topProducts.length > 0, topProducts.length);

  // Audit-integrity: after a fresh seed, EVERY SecurityEvent and ActivityLog
  // row must carry the default tenant's tenantId. This catches the seed
  // demo-log class of bug (prisma/seed.ts writing activity logs without
  // tenantId), which resurrects NULL-tenant rows on every re-seed — invisible
  // to the dashboard queries above but fatal to the tenant-scoped audit reads
  // (an audit row without a tenant belongs to nobody under strict scoping).
  const [nullSecurityEvents, nullActivityLogs] = await Promise.all([
    prisma.securityEvent.count({ where: { tenantId: null } }),
    prisma.activityLog.count({ where: { tenantId: null } }),
  ]);
  check("zero NULL-tenant SecurityEvent rows", nullSecurityEvents === 0, nullSecurityEvents);
  check("zero NULL-tenant ActivityLog rows", nullActivityLogs === 0, nullActivityLogs);

  if (failures.length > 0) {
    console.error(
      `\n❌ Seeded-dashboard check FAILED (${failures.length}): ${failures.join(", ")}`,
    );
    console.error(
      "   This usually means the seed's business rows are missing or lack tenantId while",
      "   /api/dashboard filters by it. Fix prisma/seed.ts, then re-run:",
      "   npm run db:seed && npm run check:seed",
    );
    process.exit(1);
  }
  console.log(
    "\n✅ Seeded-dashboard check passed — a fresh seed yields non-zero dashboard stats.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
