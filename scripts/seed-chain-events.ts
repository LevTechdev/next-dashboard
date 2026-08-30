import { prisma } from "@/lib/db";
import { logSecurityEvent } from "@/lib/security-events";
import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";

/**
 * Chain-exercise fixture for the audit-chain CI job.
 *
 * A FRESH seed creates ZERO SecurityEvent rows, so `npm run check:audit-chain`
 * right after a seed would pass trivially and would NOT guard the seed's
 * re-chain step. This script makes that guard real: it creates a throwaway
 * user and stamps a few SecurityEvents through the REAL logSecurityEvent path
 * (properly chained hashes), all referencing that user. A subsequent
 * `npm run db:seed` then:
 *   1. deletes every user → SecurityEvent.userId NULLed (onDelete: SetNull),
 *      which invalidates every stored hash (userId is in the canonical
 *      payload); and
 *   2. the seed's re-chain step must re-hash those rows — otherwise
 *      `npm run check:audit-chain` fails.
 *
 * Run under tsx with scripts/tsconfig.e2e.json (logSecurityEvent's chain
 * imports `server-only`, aliased to the empty stub there, exactly like the
 * tenant-isolation fixture).
 */
async function main() {
  const defaultTenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!defaultTenant) {
    throw new Error("Seed not present — run `npm run db:seed` first");
  }

  const user = await prisma.user.create({
    data: {
      name: "Chain Fixture",
      email: `chain-fixture-${Date.now()}@example.com`,
      password: bcrypt.hashSync("Chain#Fixture-2026", 10),
      passwordAlgo: "bcrypt",
      role: "STAFF",
      isActive: true,
      tenantId: defaultTenant.id,
    },
  });

  for (let i = 0; i < 3; i++) {
    await logSecurityEvent({ userId: user.id, type: "LOGIN", tenantId: defaultTenant.id });
  }

  const count = await prisma.securityEvent.count({ where: { hash: { not: null } } });
  console.log(JSON.stringify({ userId: user.id, chainedEvents: 3, totalHashed: count }));
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
