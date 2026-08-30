import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import {
  issueEmailOtp,
  isDevFallbackAllowed,
  sanitizeVerifyEmailRedirect,
} from "@/lib/email-verification";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify-email/send
 * Generates a one-hour email-verification token AND a 6-digit OTP for the
 * current user. The OTP is emailed via the configured transport (SMTP first,
 * Resend fallback) and used by the inline code entry in the Security Center;
 * the link token keeps the classic click-through flow working (and is what the
 * confirm route validates). An optional `from` hint ("profile" | "security")
 * is carried into the confirm URL so the confirm route can redirect back to
 * the surface that requested the send; it is strictly whitelisted. In
 * development (or with no mailer configured) the link and the raw code are
 * logged to the console and returned in the response, mirroring the
 * forgot-password flow.
 */
export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Already verified — idempotent success.
    if (user.emailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    const body = await req.json().catch(() => ({}));
    const locale = typeof body.locale === "string" && body.locale ? body.locale : "en";
    // Which surface requested the send — forwarded into the confirm link so the
    // post-confirm redirect lands back here.
    const from = sanitizeVerifyEmailRedirect(typeof body.from === "string" ? body.from : null);

    // 1. Link token (click-through flow / confirm route).
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // 2. Email OTP (inline code flow).
    let sent = false;
    let code = "";
    try {
      const result = await issueEmailOtp({ userId: user.id, email: user.email, locale });
      sent = result.sent;
      code = result.code;
    } catch (err) {
      console.error("[verify-email] OTP issue error:", err);
      // Fallback: generate a random 6-digit OTP for dev mode
      code = String(Math.floor(100000 + Math.random() * 900000));
    }
    console.log(
      `[verify-email] OTP issued for ${user.email}, sent=${sent}, devFallback=${isDevFallbackAllowed()}`,
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: token,
        verificationTokenExpires: expires,
      },
    });

    const origin = req.headers.get("origin") || `http://localhost:${process.env.PORT || 3010}`;
    const verificationUrl = `${origin}/api/auth/verify-email/confirm?token=${token}&locale=${locale}&from=${from}`;

    if (!sent) {
      // No mailer configured — log both so they can be used in development.
      console.log(`[verify-email] Verification link for ${user.email}: ${verificationUrl}`);
      console.log(`[verify-email] OTP for ${user.email}: ${code}`);
    }

    const devFallback = isDevFallbackAllowed();
    return NextResponse.json({
      success: true,
      ...(devFallback ? { verificationUrl } : {}),
      ...(devFallback ? { devOtp: code } : {}),
    });
  } catch (error) {
    console.error("Verify-email send error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
