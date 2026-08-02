import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * POST /api/auth/forgot-password
 * Accepts { email }, generates a one-hour reset token and stores it on the
 * user record. Always returns a generic success response to avoid leaking
 * which emails exist. In development the reset link is logged to the console
 * (no mailer is configured); returns resetUrl in dev mode for testing.
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
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
      const resetUrl = `${origin}/en/reset-password?token=${token}`;

      // No mailer configured — log the link so it can be used in development
      console.log(`[forgot-password] Reset link for ${email}: ${resetUrl}`);

      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({ success: true, resetUrl });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
