/**
 * Single source of truth for the JWT signing secret.
 *
 * Development keeps the historical fallback so a fresh clone runs without
 * configuration. Production must never sign with a known string: if the env
 * var is missing there, fail loudly instead of issuing forgeable tokens.
 */

export const DEV_JWT_SECRET = "dev-jwt-secret-change-in-production";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return DEV_JWT_SECRET;
}
