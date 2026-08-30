import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { verifyOtp, isOtpExpired, MAX_OTP_ATTEMPTS } from "@/lib/email-otp";
import { logSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify-email/otp
 * Body: { code: "123456" }
 *
 * Verifies the 6-digit email OTP issued by /verify-email/send (or at signup).
 * The stored value is a SHA-256 hash, the comparison is timing-safe, and the
 * per-user attempt counter is capped (MAX_OTP_ATTEMPTS) before the code is
 * wiped. On success the email is marked verified and an EMAIL_VERIFIED
 * security event is recorded.
 *
 * Error codes returned (client maps them to localized copy):
 * - OTP_NOT_REQUESTED  — no code outstanding for this account
 * - OTP_EXPIRED        — code older than the TTL (wiped)
 * - OTP_TOO_MANY_ATTEMPTS — attempt cap reached (wiped)
 * - OTP_INVALID        — wrong code (attemptsLeft included)
 */
export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!code) {
      return NextResponse.json({ error: "OTP_INVALID" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    if (!user.emailOtpHash) {
      return NextResponse.json({ error: "OTP_NOT_REQUESTED" }, { status: 400 });
    }

    if (isOtpExpired(user.emailOtpExpires)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailOtpHash: null, emailOtpExpires: null, emailOtpAttempts: 0 },
      });
      return NextResponse.json({ error: "OTP_EXPIRED" }, { status: 400 });
    }

    if (user.emailOtpAttempts >= MAX_OTP_ATTEMPTS) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailOtpHash: null, emailOtpExpires: null, emailOtpAttempts: 0 },
      });
      return NextResponse.json({ error: "OTP_TOO_MANY_ATTEMPTS" }, { status: 400 });
    }

    const valid = verifyOtp(code, user.emailOtpHash);

    if (!valid) {
      const attempts = user.emailOtpAttempts + 1;
      const exhausted = attempts >= MAX_OTP_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailOtpAttempts: attempts,
          ...(exhausted ? { emailOtpHash: null, emailOtpExpires: null } : {}),
        },
      });
      return NextResponse.json(
        {
          error: "OTP_INVALID",
          attemptsLeft: exhausted ? 0 : MAX_OTP_ATTEMPTS - attempts,
        },
        { status: 400 },
      );
    }

    // Success — mark verified, wipe the OTP + link token, record the event.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailOtpHash: null,
        emailOtpExpires: null,
        emailOtpAttempts: 0,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    await logSecurityEvent({
      userId: user.id,
      type: "EMAIL_VERIFIED",
      req,
      tenantId: user.tenantId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify-email OTP error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
