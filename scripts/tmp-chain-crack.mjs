import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

const p = new PrismaClient();

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}

const r = await p.securityEvent.findUnique({ where: { seq: 46 } });
const prevHash = r.prevHash ?? "0".repeat(64);
const createdAtISO = new Date(r.createdAt).toISOString();
const base = {
  userId: r.userId ?? null,
  type: r.type,
  ip: r.ip ?? null,
  userAgent: r.userAgent ?? null,
  metadata: r.metadata ?? null,
};

const variants = [
  { name: "current (sorted keys, ISO date)", fn: () => stableStringify({ ...base, createdAt: createdAtISO }) },
  { name: "insertion order JSON", fn: () => JSON.stringify({ userId: base.userId, type: base.type, ip: base.ip, userAgent: base.userAgent, metadata: base.metadata, createdAt: createdAtISO }) },
  { name: "with id", fn: () => stableStringify({ id: r.id, ...base, createdAt: createdAtISO }) },
  { name: "with seq", fn: () => stableStringify({ seq: r.seq, ...base, createdAt: createdAtISO }) },
  { name: "with id+seq", fn: () => stableStringify({ id: r.id, seq: r.seq, ...base, createdAt: createdAtISO }) },
  { name: "with prevHash", fn: () => stableStringify({ prevHash, ...base, createdAt: createdAtISO }) },
  { name: "with tenantId", fn: () => stableStringify({ tenantId: r.tenantId, ...base, createdAt: createdAtISO }) },
  { name: "Date toString", fn: () => stableStringify({ ...base, createdAt: new Date(r.createdAt).toString() }) },
  { name: "no metadata key", fn: () => stableStringify({ ...base, createdAt: createdAtISO, metadata: undefined }) },
  { name: "ip/ua raw", fn: () => stableStringify({ ...base, createdAt: createdAtISO, ip: r.ip, userAgent: r.userAgent }) },
];

for (const v of variants) {
  let canonical;
  try {
    canonical = v.fn();
  } catch {
    continue;
  }
  const hash = createHash("sha256").update(prevHash + "|" + canonical).digest("hex");
  console.log(`${hash === r.hash ? "MATCH ✓" : "no     "} ${v.name}`);
}
console.log("stored:", r.hash);

await p.$disconnect();
