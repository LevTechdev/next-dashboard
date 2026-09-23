import { requireAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/security-events";
import { resolveSessionUserId } from "@/lib/session-user";
import { isMfaReverificationDue } from "@/lib/mfa-policy";

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = await resolveSessionUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const select = {
    id: true,
    name: true,
    email: true,
    phone: true,
    position: true,
    avatar: true,
    coverImage: true,
    role: true,
    isActive: true,
    totpEnabled: true,
    emailVerified: true,
    createdAt: true,
  } as const;

  const user = await prisma.user.findUnique({ where: { id: userId }, select });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Derive the 2FA "verified on" date from the immutable TOTP_ENABLED audit
  // event so the profile can show when two-factor was activated.
  let totpVerifiedAt: Date | null = null;
  if (user.totpEnabled) {
    const evt = await prisma.securityEvent.findFirst({
      where: { userId: user.id, type: "TOTP_ENABLED" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    totpVerifiedAt = evt?.createdAt ?? null;
  }

  // 30-day MFA freshness: flag when the factor is enrolled but has not been
  // exercised (TOTP/backup-code/passkey verification) within the window, so
  // the profile can surface the re-verification alert.
  const mfaReverificationDue = await isMfaReverificationDue(user.id);

  return NextResponse.json({ ...user, totpVerifiedAt, mfaReverificationDue });
}

export async function PUT(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = await resolveSessionUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, email, phone, position } = body;

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if email is taken by another user
  if (email) {
    const emailConflict = await prisma.user.findUnique({ where: { email } });
    if (emailConflict && emailConflict.id !== userId) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(position !== undefined && { position }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      position: true,
      avatar: true,
      role: true,
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = await resolveSessionUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { password } = body;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (password) {
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 403 });
    }
  } else if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Password required to delete account" }, { status: 400 });
  }

  // Clean up user data
  await prisma.activityLog.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.deleteMany({ where: { userId: user.id } });
  await prisma.order.updateMany({ where: { userId: user.id }, data: { userId: null } });
  await prisma.user.delete({ where: { id: user.id } });

  // Wipe first, then record: the account trail survives the user row
  // (SecurityEvent is SetNull on user, and this is a credential event).
  await logSecurityEvent({
    userId: null,
    type: "ACCOUNT_DELETED",
    req,
    metadata: { email: user.email, role: user.role },
    tenantId: user.tenantId,
  });

  return NextResponse.json({ success: true, message: "Account deleted successfully" });
}
