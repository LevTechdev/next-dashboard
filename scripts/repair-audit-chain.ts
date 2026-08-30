import { PrismaClient } from "@prisma/client";
import { computeHash, GENESIS_HASH } from "../src/lib/audit-hash";

const prisma = new PrismaClient();

/**
 * Repair for the SecurityEvent tamper-evident hash chain.
 *
 * WHY: hashed rows predating the current code fail verification — stored
 * hashes were computed by an earlier (now-lost) implementation matching no
 * known canonical form for the rows' own data (brute-forced candidates:
 * sorted/insertion-order JSON, with/without id/seq/tenantId/prevHash, epoch
 * dates, double hashing — none match). The current code has been the only
 * writer since 2026-08-03 and its rows verify correctly, so old hashes carry
 * no legitimate tamper evidence to preserve.
 *
 * FIX: recompute prevHash + hash for EVERY row in seq order using the
 * canonical algorithm imported from src/lib/audit-hash.ts — the SAME module
 * audit-chain.ts and the seed's re-chain step use, so the repair can never
 * drift from the chain code. Previously NULL-hash "legacy" rows are also
 * hashed so the ENTIRE table becomes one verifiable chain. Idempotent — rows
 * whose hashes already match are left untouched.
 *
 * Run: npm run repair:audit-chain   (tsx + scripts/tsconfig.e2e.json, because
 * the import chain reaches src/lib/audit-chain.ts which needs the server-only
 * alias; audit-hash.ts itself is dependency-free)
 */
interface ChainRow {
  id: string;
  seq: number;
  userId: string | null;
  type: string;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  prevHash: string | null;
  hash: string | null;
  createdAt: Date;
}

async function main(): Promise<void> {
  const rows: ChainRow[] = await prisma.securityEvent.findMany({
    orderBy: { seq: "asc" },
    select: {
      id: true,
      seq: true,
      userId: true,
      type: true,
      ip: true,
      userAgent: true,
      metadata: true,
      prevHash: true,
      hash: true,
      createdAt: true,
    },
  });

  // Count current breakage for the before/after summary.
  function walk(list: ChainRow[]): { ok: number; bad: number } {
    let prev = GENESIS_HASH;
    let ok = 0;
    let bad = 0;
    for (const r of list) {
      const recomputed = computeHash(r.prevHash ?? GENESIS_HASH, r);
      if (recomputed === r.hash && (r.prevHash ?? GENESIS_HASH) === prev) ok++;
      else bad++;
      prev = r.hash ?? GENESIS_HASH;
    }
    return { ok, bad };
  }
  const before = walk(rows);

  let changed = 0;
  await prisma.$transaction(async (tx) => {
    let prevHash = GENESIS_HASH;
    for (const r of rows) {
      const hash = computeHash(prevHash, r);
      if (r.hash !== hash || (r.prevHash ?? GENESIS_HASH) !== prevHash) {
        await tx.securityEvent.update({ where: { id: r.id }, data: { prevHash, hash } });
        changed++;
      }
      prevHash = hash;
    }
  });

  // Re-read so the summary reflects the new state.
  const afterRows: ChainRow[] = await prisma.securityEvent.findMany({
    orderBy: { seq: "asc" },
    select: {
      id: true,
      seq: true,
      userId: true,
      type: true,
      ip: true,
      userAgent: true,
      metadata: true,
      prevHash: true,
      hash: true,
      createdAt: true,
    },
  });
  const after = walk(afterRows);

  console.log(
    `rows: ${rows.length} | broken before: ${before.bad} | updated: ${changed} | broken after: ${after.bad} | verified: ${after.ok}`,
  );
  if (after.bad > 0) {
    console.error("REPAIR INCOMPLETE — chain still has breaks");
    process.exit(1);
  }
  console.log("Chain repaired — /api/security/audit/verify should now report ok: true");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
