import "server-only";
import { prisma } from "@/lib/db";
import { computeHash, GENESIS_HASH } from "@/lib/audit-hash";

export { computeHash, GENESIS_HASH, type ChainableEvent } from "@/lib/audit-hash";

/**
 * Tamper-evident audit chain for SecurityEvent.
 *
 * Each event stores hash = sha256(prevHash | canonical(event)), where prevHash
 * is the hash of the immediately preceding event (by seq). Any insertion,
 * modification, deletion, or reordering of a past event breaks the chain and is
 * detectable by re-walking it. The first hashed event links to GENESIS_HASH.
 * The canonical form lives in src/lib/audit-hash.ts (shared with the seed's
 * re-chain step so they can never drift).
 */

export interface ChainVerification {
  ok: boolean;
  total: number; // hashed events walked
  verified: number; // events matching their recomputed hash + link
  firstBreakSeq: number | null;
  breaks: Array<{ seq: number; id: string; reason: string }>;
}

/**
 * Re-walk the hashed portion of the SecurityEvent chain and report integrity.
 * Legacy rows created before hashing (hash IS NULL) are ignored.
 */
export async function verifyAuditChain(): Promise<ChainVerification> {
  const events = await prisma.securityEvent.findMany({
    where: { hash: { not: null } },
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

  const breaks: ChainVerification["breaks"] = [];
  let expectedPrev = GENESIS_HASH;
  let verified = 0;

  for (const e of events) {
    if ((e.prevHash ?? GENESIS_HASH) !== expectedPrev) {
      breaks.push({
        seq: e.seq,
        id: e.id,
        reason: "prevHash does not match previous event hash (insert/delete/reorder)",
      });
    }
    const recomputed = computeHash(e.prevHash ?? GENESIS_HASH, e);
    if (recomputed !== e.hash) {
      breaks.push({ seq: e.seq, id: e.id, reason: "content hash mismatch (record was modified)" });
    } else if ((e.prevHash ?? GENESIS_HASH) === expectedPrev) {
      verified++;
    }
    expectedPrev = e.hash as string;
  }

  return {
    ok: breaks.length === 0,
    total: events.length,
    verified,
    firstBreakSeq: breaks.length ? breaks[0].seq : null,
    breaks,
  };
}
