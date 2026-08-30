import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logSecurityEvent } from "@/lib/security-events";
import { sanitizeVerifyEmailRedirect } from "@/lib/email-verification";

// Only these locales are served by the app; anything else falls back to en
// so the post-confirm redirect never lands on a garbage path.
const SUPPORTED_LOCALES = new Set(["en", "id", "ja", "zh"]);

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/verify-email/confirm?token=...&locale=...&from=profile|security
 * Validates the one-hour verification token, marks the user's email as
 * verified, clears the token, logs an EMAIL_VERIFIED security event, and
 * redirects back to the page that requested the send (profile or Security
 * Center) where a success toast is shown. `from` is strictly whitelisted and
 * defaults to the Security Center for unknown/missing values.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const rawLocale = url.searchParams.get("locale") || "en";
    const locale = SUPPORTED_LOCALES.has(rawLocale) ? rawLocale : "en";
    // Whitelisted redirect target; unknown/missing falls back to security.
    const from = sanitizeVerifyEmailRedirect(url.searchParams.get("from"));

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { verificationToken: token, verificationTokenExpires: { gt: new Date() } },
    });

    const origin = url.origin || `http://localhost:${process.env.PORT || 3010}`;

    if (!user) {
      // Invalid or expired token — send the user back without marking verified.
      const failedUrl = `${origin}/${locale}/${from}?verified=invalid`;
      return NextResponse.redirect(failedUrl, 302);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date(), verificationToken: null, verificationTokenExpires: null },
    });

    await logSecurityEvent({ userId: user.id, type: "EMAIL_VERIFIED", req, tenantId: user.tenantId });

    const successUrl = `${origin}/${locale}/${from}?verified=true`;
    return NextResponse.redirect(successUrl, 302);
  } catch (error) {
    console.error("Verify-email confirm error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
