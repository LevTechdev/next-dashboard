import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

const p = new PrismaClient();

const r = await p.securityEvent.findUnique({ where: { seq: 46 } });
const prevHash = r.prevHash ?? "0".repeat(64);
const full = { ...r, createdAt: new Date(r.createdAt) };
delete full.id;

const stableStringify = (v) => {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const keys = Object.keys(v).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
};

const iso = new Date(r.createdAt).toISOString();
const epochMs = new Date(r.createdAt).getTime();
const base = { userId: r.userId ?? null, type: r.type, ip: r.ip ?? null, userAgent: r.userAgent ?? null, metadata: r.metadata ?? null };

const candidates = [
  { name: "no prevHash prefix (sorted)", fn: () => stableStringify({ ...base, createdAt: iso }) },
  { name: "epoch ms date", fn: () => stableStringify({ ...base, createdAt: epochMs }) },
  { name: "full row sorted (no id)", fn: () => stableStringify({ ...full, metadata: r.metadata ?? null }) },
  { name: "full row JSON raw", fn: () => JSON.stringify(full) },
  { name: "double hash", fn: () => createHash("sha256").update(stableStringify({ ...base, createdAt: iso })).digest("hex") },
  { name: "with tenantId+id+seq", fn: () => stableStringify({ id: r.id, seq: r.seq, tenantId: r.tenantId, ...base, createdAt: iso }) },
];

for (const c of candidates) {
  let inner;
  try { inner = c.fn(); } catch { continue; }
  const hash = createHash("sha256").update(prevHash + "|" + inner).digest("hex");
  console.log(`${hash === r.hash ? "MATCH ✓" : "no     "} ${c.name}`);
}
console.log("stored:", r.hash);

await p.$disconnect();
