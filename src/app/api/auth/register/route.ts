import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signToken, type AuthUser } from "@/lib/auth";
import { isPasswordBreached } from "@/lib/hibp";
import { createSession } from "@/lib/sessions";
import { newFamilyId, createRefreshToken } from "@/lib/refresh-tokens";
import { setAuthCookies } from "@/lib/auth-cookies";
import { logSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Reject passwords found in known breach corpora (HIBP k-anonymity).
    if (await isPasswordBreached(password)) {
      return NextResponse.json(
        { error: "This password has appeared in a known data breach. Please choose another." },
        { status: 400 },
      );
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const defaultTenant = await prisma.tenant.findUnique({ where: { slug: "default" } });
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        passwordAlgo: "argon2id",
        passwordChangedAt: new Date(),
        role: "STAFF",
        isActive: true,
        tenantId: defaultTenant?.id ?? null,
      },
    });

    // Create JWT token
    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
    const token = signToken(authUser);

    const familyId = newFamilyId();
    const sessionId = await createSession({ userId: user.id, token, req, familyId });
    const refreshToken = await createRefreshToken(user.id, familyId, sessionId);
    await logSecurityEvent({ userId: user.id, type: "LOGIN", req, metadata: { registered: true } });

    const { password: _, ...safeUser } = user;

    const response = NextResponse.json({
      token,
      user: safeUser,
      message: "Account created successfully",
    });

    setAuthCookies(response, token, refreshToken);

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "An error occurred during registration" }, { status: 500 });
  }
}
