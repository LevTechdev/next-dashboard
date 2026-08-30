import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";

/**
 * POST /api/auth/forgot-password
 * Accepts { email }, generates a one-hour reset token, stores it on the user
 * record, and emails the reset link via the configured mailer (Resend). Always
 * returns a generic success response to avoid leaking which emails exist. In
 * development (or with no mailer configured) the reset link is logged to the
 * console and returned in the response for testing.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body;
    const locale = typeof body.locale === "string" && body.locale ? body.locale : "en";
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond identically whether or not the account exists
    if (user && user.isActive) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { verificationToken: token, verificationTokenExpires: expires },
      });

      const origin = req.headers.get("origin") || `http://localhost:${process.env.PORT || 3010}`;
      const resetUrl = `${origin}/${locale}/reset-password?token=${token}`;

      const { sent } = await sendPasswordResetEmail({ to: email, url: resetUrl, locale });
      if (!sent) {
        // No mailer configured — log the link so it can be used in development
        console.log(`[forgot-password] Reset link for ${email}: ${resetUrl}`);
      }

      const hasMailer = Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY);
      if (process.env.NODE_ENV !== "production" && !hasMailer) {
        return NextResponse.json({ success: true, resetUrl });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
