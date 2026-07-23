import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { TOTP } from "otplib";

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
  const totp = new TOTP();
  const isValid = totp.verify(token, secret);
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

  return NextResponse.json({ success: true });
}
