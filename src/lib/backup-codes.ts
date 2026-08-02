import "server-only";
import { prisma } from "@/lib/db";
import { createHash, randomBytes } from "crypto";

const CODE_COUNT = 10;

/** SHA-256 is appropriate here: codes are high-entropy random, need exact lookup. */
function hashCode(code: string): string {
  return createHash("sha256").update(code.replace(/-/g, "").toLowerCase()).digest("hex");
}

/** Format: xxxx-xxxx (8 hex chars, grouped) for readability. */
function generateCode(): string {
  const raw = randomBytes(4).toString("hex"); // 8 chars
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/**
 * Regenerate a user's backup codes: wipe old, create COUNT new ones.
 * Returns the plaintext codes ONCE (only shown to the user at generation time).
 */
export async function regenerateBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: CODE_COUNT }, generateCode);
  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId } }),
    prisma.backupCode.createMany({
      data: codes.map((c) => ({ userId, codeHash: hashCode(c) })),
    }),
  ]);
  return codes;
}

/** Count of unused backup codes remaining. */
export async function countUnusedBackupCodes(userId: string): Promise<number> {
  return prisma.backupCode.count({ where: { userId, usedAt: null } });
}

/**
 * Consume a backup code during 2FA fallback. Returns true if it was valid and
 * unused (and marks it used). Single-use.
 */
export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const codeHash = hashCode(code);
  const row = await prisma.backupCode.findFirst({
    where: { userId, codeHash, usedAt: null },
  });
  if (!row) return false;
  await prisma.backupCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return true;
}
