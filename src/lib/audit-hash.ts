import { createHash } from "node:crypto";

/**
 * Pure, dependency-free hashing helpers for the SecurityEvent tamper-evident
 * audit chain.
 *
 * Extracted from src/lib/audit-chain.ts so BOTH the chain code and
 * prisma/seed.ts share the EXACT same canonical form — the seed must re-chain
 * the table after wiping users (user.deleteMany() NULLs userId via
 * onDelete: SetNull, and userId is part of the canonical payload, so stored
 * hashes stop verifying). This module deliberately has NO server-only import
 * so the seed can use it under the root tsconfig.
 *
 * Each event stores hash = sha256(prevHash | canonical(event)), where prevHash
 * is the hash of the immediately preceding event (by seq). Any insertion,
 * modification, deletion, or reordering of a past event breaks the chain and
 * is detectable by re-walking it. The first hashed event links to GENESIS_HASH.
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
export function stableStringify(value: unknown): string {
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
