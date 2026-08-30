import { PrismaClient } from "@prisma/client";
import { createCipheriv, randomBytes, createHash } from "crypto";

/**
 * Encrypt existing plaintext Customer.email / phone at rest.
 * Idempotent: values already in the pii:v1: envelope are skipped.
 * Key resolution MUST match src/lib/pii.ts exactly.
 */
const PREFIX = "pii:v1:";
const prisma = new PrismaClient();

function getKey() {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (raw) {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
    const b = Buffer.from(raw, "base64");
    return b.length === 32 ? b : createHash("sha256").update(raw).digest();
  }
  return createHash("sha256").update("dev-only-pii-key-do-not-use-in-production").digest();
}
const KEY = getKey();

function encrypt(value) {
  if (value == null || value === "" || value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, ct].map((b) => b.toString("base64url")).join(":");
}

const customers = await prisma.customer.findMany({
  select: { id: true, email: true, phone: true },
});
let changed = 0;
for (const c of customers) {
  const email = encrypt(c.email);
  const phone = encrypt(c.phone);
  if (email !== c.email || phone !== c.phone) {
    await prisma.customer.update({ where: { id: c.id }, data: { email, phone } });
    changed++;
  }
}
console.log(
  `encrypted PII for ${changed}/${customers.length} customers (skipped already-encrypted)`,
);
await prisma.$disconnect();
