import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Idempotent migration: assign every legacy audit row without a tenant to the
 * default (first-created) workspace. Runs alongside `db:backfill-tenant`.
 *
 * SecurityEvent rows keep their tamper-evident hash: `tenantId` is NOT part of
 * the canonical chain payload (src/lib/audit-chain.ts hashes userId/type/ip/
 * userAgent/metadata/createdAt), so updating it never breaks verification.
 * Safe to run repeatedly (no-op once zero NULL rows remain).
 */
const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
if (!tenant) {
  throw new Error("No tenant found — run `npm run db:seed` first");
}
console.log("default tenant:", tenant.id, `(${tenant.slug})`);

const data = { tenantId: tenant.id };
const se = await prisma.securityEvent.updateMany({ where: { tenantId: null }, data });
const al = await prisma.activityLog.updateMany({ where: { tenantId: null }, data });

const seLeft = await prisma.securityEvent.count({ where: { tenantId: null } });
const alLeft = await prisma.activityLog.count({ where: { tenantId: null } });
console.log(
  `assigned → securityEvents:${se.count} activityLogs:${al.count} | remaining NULL: ${seLeft} securityEvents, ${alLeft} activityLogs`,
);

await prisma.$disconnect();
