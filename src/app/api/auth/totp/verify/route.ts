import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { resolveSessionUserId } from "@/lib/session-user";
import { verifyTotp } from "@/lib/totp";
import { logSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  // Resolve id → email → 404. No "first admin" fallback: a stale session must
  // never enroll 2FA on a different account's row.
  const userId = await resolveSessionUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { token, secret } = body;

  if (!token || !secret) {
    return NextResponse.json({ error: "Token and secret are required" }, { status: 400 });
  }

  if (typeof token !== "string" || token.length < 6) {
    return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
  }

  // Verify the TOTP code
  const isValid = verifyTotp(token, secret);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Save the secret and enable 2FA
  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpSecret: secret,
      totpEnabled: true,
    },
  });

  await logSecurityEvent({ userId: user.id, type: "TOTP_ENABLED", req, tenantId: user.tenantId });

  // The enrollment code itself is the first successful proof of the factor:
  // log MFA_VERIFIED so the 30-day freshness clock starts NOW — otherwise the
  // score banner keeps nagging to "re-verify" until the next TOTP login.
  await logSecurityEvent({ userId: user.id, type: "MFA_VERIFIED", req, tenantId: user.tenantId });

  return NextResponse.json({ success: true });
}
