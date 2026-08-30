import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

/**
 * Field-level PII encryption at rest using AES-256-GCM (authenticated encryption).
 *
 * Stored format:  pii:v1:<iv_b64url>:<authTag_b64url>:<ciphertext_b64url>
 *
 * - Encryption is idempotent: re-encrypting an already-encrypted value is a no-op.
 * - Decryption is backward-compatible: values without the pii: prefix (legacy
 *   plaintext) are returned unchanged, so encryption can be rolled out gradually.
 */

const PREFIX = "pii:v1:";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (raw) {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      cachedKey = Buffer.from(raw, "hex");
    } else {
      const b = Buffer.from(raw, "base64");
      cachedKey = b.length === 32 ? b : createHash("sha256").update(raw).digest();
    }
    return cachedKey;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("PII_ENCRYPTION_KEY environment variable is required in production");
  }
  // Deterministic dev-only key so local data round-trips across restarts.
  console.warn(
    "[pii] PII_ENCRYPTION_KEY not set — using insecure dev key. Do NOT use in production.",
  );
  cachedKey = createHash("sha256").update("dev-only-pii-key-do-not-use-in-production").digest();
  return cachedKey;
}

/** Encrypt a value for storage. Null/empty pass through; already-encrypted values are returned as-is. */
export function encryptPII(value: string | null | undefined): string | null {
  if (value == null || value === "") return value == null ? null : value;
  if (value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(":");
}

/** Decrypt a stored value. Legacy plaintext (no prefix) is returned unchanged. */
export function decryptPII(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (typeof stored !== "string" || !stored.startsWith(PREFIX)) return stored;
  try {
    const parts = stored.split(":");
    // ["pii", "v1", iv, tag, ciphertext]
    const iv = Buffer.from(parts[2], "base64url");
    const tag = Buffer.from(parts[3], "base64url");
    const ciphertext = Buffer.from(parts[4], "base64url");
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    // Tampered/undecryptable — never leak ciphertext to callers.
    return null;
  }
}

/** True if a stored value is in the encrypted envelope format. */
export function isEncrypted(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

type CustomerPII = { email?: string | null; phone?: string | null };

/** Encrypt the PII fields of a customer-shaped write payload. */
export function encryptCustomerPII<T extends CustomerPII>(data: T): T {
  return { ...data, email: encryptPII(data.email), phone: encryptPII(data.phone) };
}

/** Decrypt the PII fields of a customer-shaped row before returning to the client. */
export function decryptCustomerPII<T extends CustomerPII>(row: T): T {
  if (!row) return row;
  return { ...row, email: decryptPII(row.email), phone: decryptPII(row.phone) };
}

/** Decrypt a nested `customer` relation (e.g. on an order) in place-safe fashion. */
export function withDecryptedCustomer<T extends { customer?: CustomerPII | null }>(row: T): T {
  if (row && row.customer) return { ...row, customer: decryptCustomerPII(row.customer) };
  return row;
}
