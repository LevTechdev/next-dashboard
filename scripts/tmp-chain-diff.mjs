import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

const p = new PrismaClient();

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}

function compute(prevHash, e) {
  const createdAt = e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt);
  const canonical = stableStringify({
    userId: e.userId ?? null,
    type: e.type,
    ip: e.ip ?? null,
    userAgent: e.userAgent ?? null,
    metadata: e.metadata ?? null,
    createdAt: createdAt.toISOString(),
  });
  return { canonical, hash: createHash("sha256").update(prevHash + "|" + canonical).digest("hex") };
}

const rows = await p.securityEvent.findMany({
  orderBy: { seq: "asc" },
  select: { id: true, seq: true, userId: true, type: true, ip: true, userAgent: true, metadata: true, prevHash: true, hash: true, createdAt: true },
});

const targets = [46, 47, 48, 100, 500, 1324];
for (const seq of targets) {
  const r = rows.find((x) => x.seq === seq);
  if (!r) continue;
  const { canonical, hash } = compute(r.prevHash ?? "0".repeat(64), r);
  const mdRaw = r.metadata === null ? "null" : JSON.stringify(r.metadata);
  console.log(`seq ${seq} ${r.type}`);
  console.log(`  userId=${r.userId ?? "null"} ip=${JSON.stringify(r.ip)} ua=${JSON.stringify(r.userAgent)} metadata=${mdRaw}`);
  console.log(`  createdAt=${new Date(r.createdAt).toISOString()} raw=${r.createdAt}`);
  console.log(`  storedHash=${r.hash}`);
  console.log(`  recomputed=${hash} ${hash === r.hash ? "MATCH" : "MISMATCH"}`);
  console.log(`  prevHash=${r.prevHash}`);
  console.log(`  canonical=${canonical.slice(0, 120)}...`);
  console.log("");
}

// Check the first hashed event's prevHash: does it link to GENESIS?
const firstHashed = rows.find((r) => r.hash !== null);
console.log("first hashed row:", firstHashed?.seq, "prevHash === GENESIS?", firstHashed?.prevHash === "0".repeat(64));
// How many hashed rows total, how many match?
let hashed = 0, match = 0;
let expectedPrev = "0".repeat(64);
for (const r of rows) {
  if (r.hash === null) continue;
  hashed++;
  const { hash } = compute(r.prevHash ?? "0".repeat(64), r);
  if (hash === r.hash && (r.prevHash ?? "0".repeat(64)) === expectedPrev) match++;
  expectedPrev = r.hash;
}
console.log(`hashed rows: ${hashed}, linked+matched: ${match}`);

await p.$disconnect();
