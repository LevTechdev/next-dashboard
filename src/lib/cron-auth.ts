import { timingSafeEqual } from "node:crypto";

/**
 * Verify a cron request's shared secret.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` and does not interpolate
 * env vars inside vercel.json, so the header is authoritative. The `?secret=`
 * query remains for self-hosted schedulers and manual runs, but is checked
 * second — a literal `${CRON_SECRET}` in a URL must never shadow a valid
 * header.
 */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const { searchParams } = new URL(req.url);
  const header = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const provided = header || searchParams.get("secret")?.trim() || "";
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
