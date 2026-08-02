import "server-only";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-in-production";
const STEP_UP_TTL = "5m";
export const STEP_UP_COOKIE = "step_up";

export type StepUpPurpose =
  "change_password" | "change_email" | "update_billing" | "delete_account" | "manage_2fa";

interface StepUpClaims {
  sub: string; // userId
  purpose: StepUpPurpose;
  kind: "step_up";
}

/** Issue a short-lived (5 min) step-up token after a re-auth challenge passes. */
export function signStepUpToken(userId: string, purpose: StepUpPurpose): string {
  return jwt.sign({ sub: userId, purpose, kind: "step_up" } as StepUpClaims, JWT_SECRET, {
    expiresIn: STEP_UP_TTL,
  });
}

/**
 * Verify a step-up token matches the acting user AND the requested purpose.
 * Sensitive endpoints call this before performing the action.
 */
export function verifyStepUpToken(
  token: string | undefined,
  userId: string,
  purpose: StepUpPurpose,
): boolean {
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as StepUpClaims;
    return decoded.kind === "step_up" && decoded.sub === userId && decoded.purpose === purpose;
  } catch {
    return false;
  }
}

/** Read the step-up cookie from a request. */
export function getStepUpToken(req: Request): string | undefined {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return undefined;
  for (const c of cookieHeader.split(";").map((x) => x.trim())) {
    if (c.startsWith(`${STEP_UP_COOKIE}=`)) return c.slice(STEP_UP_COOKIE.length + 1);
  }
  return undefined;
}
