import "server-only";
import { prisma } from "@/lib/db";
import { createHash } from "crypto";
import { getClientIp } from "@/lib/request-meta";

export type ApiKeyResult =
  | { ok: true; userId: string | null; permissions: string; keyId: string }
  | { ok: false; status: number; error: string };

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * IP allowlist check. Empty list = allow any. Supports exact IPv4/IPv6 match
 * and simple octet-aligned IPv4 CIDR (/8, /16, /24).
 */
function ipAllowed(clientIp: string, allow: string[]): boolean {
  if (!allow || allow.length === 0) return true;
  return allow.some((raw) => {
    const entry = raw.trim();
    if (!entry) return false;
    if (entry === clientIp) return true;
    if (entry.includes("/")) {
      const [net, bitsStr] = entry.split("/");
      const bits = parseInt(bitsStr, 10);
      const octets = Math.floor(bits / 8);
      if (octets > 0 && net.includes(".") && clientIp.includes(".")) {
        return (
          net.split(".").slice(0, octets).join(".") ===
          clientIp.split(".").slice(0, octets).join(".")
        );
      }
    }
    return false;
  });
}

/**
 * Authenticate a request via a scoped API key in the Authorization header
 * (`Bearer dash_...`). Enforces status, expiry, IP allowlist and scope, and
 * records last-used. Use in public/programmatic API routes.
 */
export async function verifyApiKey(
  req: Request,
  requiredScope?: "read" | "write" | "admin",
): Promise<ApiKeyResult> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { ok: false, status: 401, error: "Missing API key" };

  const raw = auth.slice(7).trim();
  if (!raw.startsWith("dash_")) return { ok: false, status: 401, error: "Invalid API key format" };

  const key = await prisma.apiKey.findUnique({ where: { key: hashKey(raw) } });
  if (!key) return { ok: false, status: 401, error: "Invalid API key" };
  if (key.status !== "ACTIVE") return { ok: false, status: 403, error: "API key revoked" };
  if (key.expiresAt && key.expiresAt < new Date())
    return { ok: false, status: 403, error: "API key expired" };

  if (!ipAllowed(getClientIp(req), key.ipAllowlist))
    return { ok: false, status: 403, error: "Client IP not allowed" };

  const scopes = key.permissions.split(",").map((s) => s.trim());
  if (requiredScope && !scopes.includes(requiredScope) && !scopes.includes("admin")) {
    return { ok: false, status: 403, error: `Missing required scope: ${requiredScope}` };
  }

  await prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { ok: true, userId: key.userId, permissions: key.permissions, keyId: key.id };
}
