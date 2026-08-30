import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";

/**
 * POST /api/auth/reset-password
 * Accepts { token, password }, validates the token and expiry, then updates
 * the user's password and clears the token.
 */
export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await hashPassword(password),
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    await prisma.activityLog.create({
      data: {
        action: "RESET_PASSWORD",
        entity: "User",
        entityId: user.id,
        details: `Password reset for ${user.email}`,
        userId: user.id,
        tenantId: user.tenantId,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
