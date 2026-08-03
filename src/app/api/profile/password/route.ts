import { requireAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { isPasswordBreached } from "@/lib/hibp";
import { getStepUpToken, verifyStepUpToken } from "@/lib/step-up";
import { revokeOtherSessions } from "@/lib/sessions";
import { getTokenFromCookie, getTokenFromRequest } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/security-events";

export async function PUT(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = session.user.id;

  // Sensitive action: require a valid step-up challenge.
  if (!verifyStepUpToken(getStepUpToken(req), userId, "change_password")) {
    return NextResponse.json(
      { error: "Re-authentication required", stepUpRequired: true },
      { status: 401 },
    );
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new passwords required" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isValid = await verifyPassword(currentPassword, user.password);
  if (!isValid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
  }

  // Block breached passwords (HIBP k-anonymity).
  if (await isPasswordBreached(newPassword)) {
    return NextResponse.json(
      { error: "This password has appeared in a known data breach. Please choose another." },
      { status: 400 },
    );
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, passwordAlgo: "argon2id", passwordChangedAt: new Date() },
  });

  // Invalidate other sessions after a password change (keep current).
  const token = getTokenFromRequest(req) || getTokenFromCookie(req);
  if (token) await revokeOtherSessions(user.id, token);

  await logSecurityEvent({ userId: user.id, type: "PASSWORD_CHANGE", req });

  return NextResponse.json({ success: true, message: "Password changed successfully" });
}
