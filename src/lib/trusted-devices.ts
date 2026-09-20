import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { parseUserAgent } from "@/lib/request-meta";

/**
 * Trusted-device store.
 *
 * A device the user marked "trust for 30 days" while completing a second
 * factor. Trust SKIPS 2FA on sign-in (GitHub/Google model). The trust token is
 * a random 32-byte value in an httpOnly cookie; only its SHA-256 is stored.
 * A cookie is honored only when the row is un-revoked, un-expired, AND the
 * current device+browser profile matches the row — so a stolen cookie is
 * useless on any other machine.
 *
 * IP is deliberately NOT part of the match: laptops move between networks.
 * A trusted device used from a new IP still triggers the new-sign-in alert
 * (that path is independent of trust), which covers the stolen-cookie-at-a-
 * new-location case without nagging users who simply switched Wi-Fi.
 */

export const TRUST_TTL_DAYS = 30;
export const TRUST_COOKIE = "trusted_device";

export function trustTtlMs(): number {
  return TRUST_TTL_DAYS * 24 * 60 * 60 * 1000;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface TrustDecision {
  device: {
    id: string;
    label: string | null;
    expiresAt: Date;
  };
}

/**
 * Check the request's trust cookie against the user's trusted-device rows.
 * Honors a row only when it is un-revoked, un-expired, and the current
 * device+browser profile matches what was trusted. Bumps lastUsedAt on hit.
 */
export async function findTrustedDevice(
  req: Request,
  userId: string,
): Promise<TrustDecision | null> {
  const token = readTrustCookie(req);
  if (!token) return null;

  const meta = parseUserAgent(req.headers.get("user-agent") || "");

  const row = await prisma.trustedDevice.findUnique({
    where: { tokenHash: sha256(token) },
    select: {
      id: true,
      userId: true,
      device: true,
      browser: true,
      label: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!row || row.userId !== userId || row.revokedAt || row.expiresAt <= new Date()) {
    return null;
  }
  if (row.device !== meta.device || row.browser !== meta.browser) {
    return null;
  }

  // Best-effort activity stamp; never block the sign-in on it.
  await prisma.trustedDevice
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { device: { id: row.id, label: row.label, expiresAt: row.expiresAt } };
}

/**
 * Mint a trust token, store its hash, and return the raw token (the caller
 * sets it as a cookie on the response). Call only while completing a second
 * factor — trust is never granted from a password-only sign-in.
 */
export async function issueTrustToken(
  userId: string,
  req: Request,
): Promise<{ token: string; expiresAt: Date; label: string }> {
  const token = randomBytes(32).toString("base64url");
  const meta = parseUserAgent(req.headers.get("user-agent") || "");
  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "";
  const expiresAt = new Date(Date.now() + trustTtlMs());
  const label = `${meta.device} · ${meta.browser}`;

  await prisma.trustedDevice.create({
    data: {
      userId,
      tokenHash: sha256(token),
      device: meta.device,
      browser: meta.browser,
      ipHash: ip ? sha256(ip) : null,
      label,
      expiresAt,
    },
  });

  return { token, expiresAt, label };
}

/** Cookie options for the trust token — 30 days, httpOnly, Lax. */
export function trustCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  };
}

export function readTrustCookie(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${TRUST_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Revoke one trusted device (ownership enforced by userId). */
export async function revokeTrustedDevice(id: string, userId: string): Promise<boolean> {
  const res = await prisma.trustedDevice.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

/** Revoke every trusted device of the user (the Security Center's "all" action). */
export async function revokeAllTrustedDevices(userId: string): Promise<number> {
  const res = await prisma.trustedDevice.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count;
}

/** List the user's un-revoked devices, newest activity first. */
export async function listTrustedDevices(
  userId: string,
): Promise<
  Array<{
    id: string;
    label: string | null;
    device: string;
    browser: string;
    createdAt: Date;
    lastUsedAt: Date;
    expiresAt: Date;
  }>
> {
  return prisma.trustedDevice.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      label: true,
      device: true,
      browser: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });
}
