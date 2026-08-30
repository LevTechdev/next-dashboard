import jwt from "jsonwebtoken";
import { compare } from "bcryptjs";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { createHash, randomBytes } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-in-production";
// Short-lived access token (Phase 2). Long-lived auth is carried by the
// rotating refresh token instead.
const JWT_EXPIRES_IN = "15m";

/** Cookie names for the access + refresh tokens. */
export const ACCESS_COOKIE = "token";
export const REFRESH_COOKIE = "refresh_token";
export const ACCESS_MAX_AGE = 15 * 60; // 15 min
export const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId?: string | null;
}

// OWASP-recommended Argon2id parameters (memory-hard).
const ARGON2_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

/** Hash a password with Argon2id. */
export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON2_OPTS);
}

/**
 * Verify a password against either an Argon2id hash (new) or a bcrypt hash
 * (legacy), detected by prefix. Enables transparent migration on next login.
 */
export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  try {
    if (hashed.startsWith("$argon2")) return await argonVerify(hashed, password);
    // Legacy bcrypt hashes ($2a$/$2b$/$2y$)
    return await compare(password, hashed);
  } catch {
    return false;
  }
}

/** True when the stored hash is not Argon2id and should be re-hashed on login. */
export function needsRehash(hashed: string): boolean {
  return !hashed.startsWith("$argon2id");
}

export function signToken(user: AuthUser): string {
  // A unique jti guarantees every access token (and thus its SHA-256 hash) is
  // distinct, even for rapid successive logins in the same second — otherwise
  // the Session.tokenHash unique constraint can collide.
  return jwt.sign(user, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    jwtid: randomBytes(16).toString("hex"),
  });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

/** SHA-256 of a token — stored on Session/RefreshToken so raw tokens are never persisted. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Generate a high-entropy opaque refresh token (not a JWT). */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers?.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

export function getTokenFromCookie(request: Request): string | null {
  const cookieHeader = request.headers?.get("cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith("token=")) {
      return cookie.slice(6);
    }
  }
  return null;
}
