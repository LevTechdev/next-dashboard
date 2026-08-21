import { prisma } from "@/lib/db";
import { computeHash, GENESIS_HASH } from "@/lib/audit-hash";
import { logSecurityEvent, type SecurityEventType } from "@/lib/security-events";
import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";

/**
 * Tenant-isolation fixture for e2e/tenant-isolation.spec.ts.
 *
 * Creates a SECOND workspace ("tenant-b") plus a STAFF actor inside it, then
 * stamps distinguishable audit markers on each side:
 *   - activityLog A/B rows (ActivityLog has no hash chain → plain inserts)
 *   - SecurityEvents via the REAL logSecurityEvent write path, so the
 *     tamper-evident hash chain stays intact (see src/lib/audit-chain.ts)
 *   - a "poisoned" security event carrying the DEFAULT workspace's userId but
 *     TENANT B's tenantId — the read-side tenant scope must hide it from both
 *     feeds (this is the sharpest proof the tenant layer, not just the userId
 *     filter, is enforced)
 *
 * Idempotent: prior-run markers (matching action/type names) are cleared first.
 * The script is run under tsx with scripts/tsconfig.e2e.json, which aliases
 * "server-only" to the empty stub exactly like the vitest configs do.
 */
export const ISOLATION = {
  tenantSlug: "tenant-b",
  email: `isolation-b-${Date.now()}@example.com`,
  password: "Iso#B-2026-xQ7",
  actionA: "ISOLATION_TENANT_A_ACTION",
  actionB: "ISOLATION_TENANT_B_ACTION",
  eventA: "ISOLATION_TENANT_A_EVENT" as SecurityEventType,
  eventB: "ISOLATION_TENANT_B_EVENT" as SecurityEventType,
  contaminated: "ISOLATION_CONTAMINATED_EVENT" as SecurityEventType,
};

export async function seedTenantIsolation() {
  const defaultTenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  const admin = await prisma.user.findUnique({ where: { email: "admin@dashboard.com" } });
  if (!defaultTenant || !admin) {
    throw new Error("Seed not present — run `npm run db:seed` first");
  }

  const tenantB = await prisma.tenant.upsert({
    where: { slug: ISOLATION.tenantSlug },
    update: {},
    create: { name: "Tenant B (Isolation)", slug: ISOLATION.tenantSlug },
  });

  // Fresh actor in tenant B with a known password (bcrypt is accepted by the
  // login route via passwordAlgo: "bcrypt").
  const bUser = await prisma.user.create({
    data: {
      name: "Isolation B",
      email: ISOLATION.email,
      password: bcrypt.hashSync(ISOLATION.password, 10),
      passwordAlgo: "bcrypt",
      role: "STAFF",
      isActive: true,
      tenantId: tenantB.id,
    },
  });

  // Clear any prior-run markers so the assertions stay deterministic.
  await prisma.activityLog.deleteMany({
    where: { OR: [{ action: ISOLATION.actionA }, { action: ISOLATION.actionB }] },
  });
  await prisma.securityEvent.deleteMany({
    where: {
      OR: [
        { type: ISOLATION.eventA },
        { type: ISOLATION.eventB },
        { type: ISOLATION.contaminated },
      ],
    },
  });

  // The deleteMany above removes PREVIOUS runs' markers from the middle of the
  // tamper-evident chain, which breaks every subsequent link — that's the
  // chain doing its job, but the fixture must not leave a false-positive
  // break behind (CI's `npm run check:audit-chain` walks the whole chain).
  // Re-chain the remaining rows, exactly like prisma/seed.ts does after
  // wiping users, so the fresh markers below link onto a consistent tail.
  {
    const events = await prisma.securityEvent.findMany({ orderBy: { seq: "asc" } });
    let prevHash = GENESIS_HASH;
    for (const e of events) {
      const hash = computeHash(prevHash, e);
      if (e.hash !== hash || (e.prevHash ?? GENESIS_HASH) !== prevHash) {
        await prisma.securityEvent.update({
          where: { id: e.id },
          data: { prevHash, hash },
        });
      }
      prevHash = hash;
    }
  }

  await prisma.activityLog.create({
    data: {
      action: ISOLATION.actionA,
      entity: "Isolation",
      details: "Tenant A marker",
      userId: admin.id,
      tenantId: defaultTenant.id,
    },
  });
  await prisma.activityLog.create({
    data: {
      action: ISOLATION.actionB,
      entity: "Isolation",
      details: "Tenant B marker",
      userId: bUser.id,
      tenantId: tenantB.id,
    },
  });

  await logSecurityEvent({ userId: admin.id, type: ISOLATION.eventA, tenantId: defaultTenant.id });
  await logSecurityEvent({ userId: bUser.id, type: ISOLATION.eventB, tenantId: tenantB.id });
  // Poisoned: admin's userId, tenant B's id — must be invisible to BOTH.
  await logSecurityEvent({ userId: admin.id, type: ISOLATION.contaminated, tenantId: tenantB.id });

  return ISOLATION;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  seedTenantIsolation()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
