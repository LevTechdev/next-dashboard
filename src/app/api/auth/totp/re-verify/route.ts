import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { resolveSessionUserId } from "@/lib/session-user";
import { verifyTotp } from "@/lib/totp";
import { logSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/totp/re-verify — 30-day MFA freshness check.
 *
 * Verifies a TOTP code against the user's STORED secret (never a client-supplied
 * one — this endpoint proves the authenticator still works, it does not enroll
 * anything) and records MFA_VERIFIED, which resets the freshness window. The
 * profile alert (`mfaReverificationDue`) clears on the next profile load.
 */
export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = await resolveSessionUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { token } = body as { token?: string };

  if (!token || typeof token !== "string" || token.length < 6) {
    return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, totpSecret: true, totpEnabled: true, tenantId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!user.totpEnabled || !user.totpSecret) {
    return NextResponse.json(
      { error: "Two-factor authentication is not enabled" },
      { status: 400 },
    );
  }

  if (!verifyTotp(token, user.totpSecret)) {
    return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
  }

  await logSecurityEvent({
    userId: user.id,
    type: "MFA_VERIFIED",
    req,
    metadata: { method: "reverify" },
    tenantId: user.tenantId,
  });

  return NextResponse.json({ success: true });
}
