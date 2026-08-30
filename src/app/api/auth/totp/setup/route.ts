import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { generateTotpSecret, totpKeyUri } from "@/lib/totp";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = session.user.id;

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

  // Generate a new TOTP secret
  const secret = await generateTotpSecret();

  // Create otpauth URL for QR code
  const otpauth = totpKeyUri({ issuer: "Dashboard", email: user.email, secret });

  // Generate QR code as data URL
  const qrCode = await QRCode.toDataURL(otpauth);

  return NextResponse.json({ qrCode, secret });
}
