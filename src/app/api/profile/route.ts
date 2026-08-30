import { requireAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = session.user.id;

  const select = {
    id: true,
    name: true,
    email: true,
    phone: true,
    position: true,
    avatar: true,
    role: true,
    isActive: true,
    totpEnabled: true,
    emailVerified: true,
    createdAt: true,
  } as const;

  // Try the token's user id first, fall back to the first admin (mock-id dev setup).
  let user = await prisma.user.findUnique({ where: { id: userId }, select });
  if (!user) {
    user = await prisma.user.findFirst({ where: { role: "ADMIN" }, select });
  }
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

  return NextResponse.json({ ...user, totpVerifiedAt });
}

export async function PUT(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = session.user.id;

  const body = await req.json();
  const { name, email, phone, position } = body;

  // Try findUnique first, fallback to first admin
  let existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    existing = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if email is taken by another user
  if (email) {
    const emailConflict = await prisma.user.findUnique({ where: { email } });
    if (emailConflict && emailConflict.id !== existing.id) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
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
  const userId = session.user.id;

  const body = await req.json();
  const { password } = body;

  // Try findUnique first, fallback to first admin
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

  return NextResponse.json({ success: true, message: "Account deleted successfully" });
}
