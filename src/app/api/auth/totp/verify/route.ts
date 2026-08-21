import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { verifyTotp } from "@/lib/totp";
import { logSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = session.user.id;

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

  // Find the user
  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    user = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
    });
  }
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

  return NextResponse.json({ success: true });
}
