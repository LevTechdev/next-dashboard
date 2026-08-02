import "server-only";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";

/**
 * Tamper-evident audit chain for SecurityEvent.
 *
 * Each event stores hash = sha256(prevHash | canonical(event)), where prevHash
 * is the hash of the immediately preceding event (by seq). Any insertion,
 * modification, deletion, or reordering of a past event breaks the chain and is
 * detectable by re-walking it. The first hashed event links to GENESIS_HASH.
 */

export const GENESIS_HASH = "0".repeat(64);

export interface ChainableEvent {
  userId: string | null;
  type: string;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date | string;
}

/** Deterministic serialization independent of object key order. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

function canonicalEvent(e: ChainableEvent): string {
  const createdAt = e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt);
  return stableStringify({
    userId: e.userId ?? null,
    type: e.type,
    ip: e.ip ?? null,
    userAgent: e.userAgent ?? null,
    metadata: e.metadata ?? null,
    createdAt: createdAt.toISOString(),
  });
}

/** Compute the chain hash for an event given the previous event's hash. */
export function computeHash(prevHash: string, e: ChainableEvent): string {
  return createHash("sha256")
    .update(prevHash + "|" + canonicalEvent(e))
    .digest("hex");
}

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
