import "server-only";
import * as otplib from "otplib";

/**
 * TOTP wrapper that insulates the app from otplib API drift. The installed
 * otplib exposes an async/new surface (`verifySync`, `generate`, `generateSecret`)
 * while older code used a sync instance API. We access the new functional API
 * through a locally-typed view so verification is a stable synchronous boolean.
 */
interface OtplibNew {
  verifySync?: (o: { token: string; secret: string }) => { valid: boolean };
  generateSync?: (o: { secret: string }) => string;
  generateSecret?: () => string | Promise<string>;
}
const lib = otplib as unknown as OtplibNew;

/** Verify a TOTP token against a base32 secret. Synchronous boolean. */
export function verifyTotp(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const clean = token.replace(/\s/g, "");
  try {
    if (typeof lib.verifySync === "function") {
      return lib.verifySync({ token: clean, secret }).valid === true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Generate a new base32 TOTP secret. */
export async function generateTotpSecret(): Promise<string> {
  if (typeof lib.generateSecret === "function") {
    return await lib.generateSecret();
  }
  // Fallback: 20 random bytes → base32 (RFC 4648, no padding).
  const { randomBytes } = await import("crypto");
  const bytes = randomBytes(20);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

/**
 * Build a standard otpauth:// key URI for authenticator apps / QR codes.
 * (Constructed by hand to avoid otplib's drifting toURI helper.)
 */
export function totpKeyUri(params: { email: string; secret: string; issuer?: string }): string {
  const issuer = params.issuer || "Dashboard";
  const label = encodeURIComponent(`${issuer}:${params.email}`);
  const q = new URLSearchParams({
    secret: params.secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}
