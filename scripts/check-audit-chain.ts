/**
 * SecurityEvent hash-chain integrity check (CI step + local).
 *
 * Fails when the tamper-evident audit chain is broken — the corruption class
 * that previously accumulated silently in the dev DB (hashed rows written by a
 * lost pre-repo implementation mismatching the current canonical form, plus
 * NULL-hash "legacy" rows the verify walk skips entirely).
 *
 * Uses the REAL production verifier (src/lib/audit-chain.ts's
 * verifyAuditChain — the exact function behind GET /api/security/audit/verify)
 * so this can never drift from what the endpoint reports. Runs under tsx with
 * scripts/tsconfig.e2e.json because audit-chain.ts imports `server-only`
 * (aliased to the empty stub) and `@/lib/db` (aliased to ../src/lib/db).
 *
 * Fails when EITHER:
 *   1. verifyAuditChain().ok === false — a break exists (content mismatch,
 *      prevHash mismatch after insert/delete/reorder), mirroring the 409 the
 *      admin endpoint returns; or
 *   2. any SecurityEvent row has a NULL hash — rows outside the chain that the
 *      verify walk silently skips. On a fresh seed there are none (every event
 *      flows through logSecurityEvent, which always hashes), so any NULL-hash
 *      row means corruption or a legacy pre-hashing table — run
 *      `npm run repair:audit-chain` to re-chain it; or
 *   3. tenant attribution is broken — a hashed row with a NULL tenantId, or a
 *      tenantId that references NO existing Tenant (cross-tenant
 *      contamination: a deleted tenant, a bogus id, a cross-DB import). The
 *      chain is deliberately MULTI-tenant (the isolation fixture stamps
 *      tenant-b events into it), so the assertion is attribution integrity,
 *      not "default tenant only". tenantId is NOT part of the canonical hash
 *      payload, so only this check can catch this class.
 *
 * NOTE: `npm run db:seed` DELETES all users, and SecurityEvent.userId has
 * onDelete: SetNull — so re-seeding mutates every event whose user is wiped,
 * and since userId is part of the canonical hash payload, a re-seed breaks the
 * chain until repair re-chains it. In CI the seed runs once against an empty
 * table (no events exist to null), so the post-E2E check stays green; in dev,
 * run `npm run repair:audit-chain` after any re-seed if you care about the
 * chain.
 *
 * Run:  npm run check:audit-chain
 */
import { verifyAuditChain } from "../src/lib/audit-chain";
import { prisma } from "../src/lib/db";

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
  console.log("🔎 Verifying SecurityEvent hash chain…");

  const result = await verifyAuditChain();
  check(
    "chain verifies clean (ok)",
    result.ok,
    { firstBreakSeq: result.firstBreakSeq, breaks: result.breaks.slice(0, 5) },
  );
  check(
    "all hashed events verified",
    result.verified === result.total,
    { verified: result.verified, total: result.total },
  );

  const nullHashed = await prisma.securityEvent.count({ where: { hash: null } });
  check("zero NULL-hash SecurityEvent rows", nullHashed === 0, { nullHashed });

  // Tenant attribution: the chain is deliberately MULTI-tenant (the isolation
  // fixture stamps tenant-b events into it), so a "default-tenant-only"
  // assertion would be wrong. Assert attribution integrity instead — every
  // hashed row must carry a non-NULL tenantId that references an EXISTING
  // tenant. A row pointing at a deleted/bogus tenant (cross-tenant
  // contamination) or missing attribution entirely is invisible to the hash
  // chain itself, because tenantId is NOT part of the canonical payload.
  const hashedRows = await prisma.securityEvent.findMany({
    where: { hash: { not: null } },
    select: { tenantId: true },
  });
  const nullTenant = hashedRows.filter((r) => r.tenantId === null).length;
  const tenantIds = [
    ...new Set(hashedRows.map((r) => r.tenantId).filter((id): id is string => Boolean(id))),
  ];
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true },
  });
  const existing = new Set(tenants.map((t) => t.id));
  const orphaned = tenantIds.filter((id) => !existing.has(id));
  check("zero hashed rows with NULL tenantId", nullTenant === 0, { nullTenant });
  check(
    "every hashed row's tenantId references an existing tenant",
    orphaned.length === 0,
    { orphanedTenantIds: orphaned, tenantsOnChain: tenantIds.length },
  );

  if (failures.length > 0) {
    console.error(
      `\n❌ Audit-chain check FAILED (${failures.length}): ${failures.join(", ")}`,
    );
    console.error(
      "   The tamper-evident chain is broken or has rows outside it. If these are",
      "   legacy pre-hashing rows, re-chain them once with:",
      "   npm run repair:audit-chain && npm run check:audit-chain",
    );
    process.exit(1);
  }
  console.log(
    `\n✅ Audit-chain check passed — ${result.total} hashed events, ${result.verified} verified, 0 NULL-hash rows, tenant attribution intact.`,
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
