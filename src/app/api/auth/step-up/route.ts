import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { verifyPassword } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import { signStepUpToken, STEP_UP_COOKIE, type StepUpPurpose } from "@/lib/step-up";
import { logSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

const VALID_PURPOSES: StepUpPurpose[] = [
  "change_password",
  "change_email",
  "update_billing",
  "delete_account",
  "manage_2fa",
];

/**
 * POST: re-authenticate the current user (password or TOTP) to unlock a
 * sensitive action. On success, sets a 5-minute step-up cookie the target
 * endpoint verifies.
 */
export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const body = await req.json();
  const { purpose, password, totpToken } = body as {
    purpose: StepUpPurpose;
    password?: string;
    totpToken?: string;
  };

  if (!purpose || !VALID_PURPOSES.includes(purpose)) {
    return NextResponse.json({ error: "Invalid step-up purpose" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify via TOTP if the user has 2FA, else via password.
  let verified = false;
  if (totpToken && user.totpEnabled && user.totpSecret) {
    verified = verifyTotp(totpToken, user.totpSecret);
  } else if (password) {
    verified = await verifyPassword(password, user.password);
  }

  if (!verified) {
    return NextResponse.json({ error: "Verification failed" }, { status: 401 });
  }

  const stepUpToken = signStepUpToken(user.id, purpose);
  await logSecurityEvent({ userId: user.id, type: "STEP_UP_VERIFIED", req, metadata: { purpose } });

  const res = NextResponse.json({ success: true });
  res.cookies.set(STEP_UP_COOKIE, stepUpToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 5 * 60,
    path: "/",
  });
  return res;
}
