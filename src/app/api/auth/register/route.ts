import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signToken, type AuthUser } from "@/lib/auth";
import { isPasswordBreached } from "@/lib/hibp";
import { createSession } from "@/lib/sessions";
import { newFamilyId, createRefreshToken } from "@/lib/refresh-tokens";
import { setAuthCookies } from "@/lib/auth-cookies";
import { logSecurityEvent } from "@/lib/security-events";
import { issueEmailOtp, isDevFallbackAllowed } from "@/lib/email-verification";

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
    await logSecurityEvent({
      userId: user.id,
      type: "LOGIN",
      req,
      metadata: { registered: true },
      tenantId: user.tenantId,
    });

    // Tenant-scoped audit trail entry so the registration shows up in the
    // workspace's activity log without leaking across tenant boundaries.
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "REGISTER",
        entity: "User",
        entityId: user.id,
        details: `Account ${user.email} registered`,
        tenantId: user.tenantId,
      },
    });

    // Identity verification: every new account is issued a 6-digit email OTP.
    // Best-effort — a mail outage must never block account creation; the OTP
    // can be re-requested from the Security Center (send route) afterwards.
    const emailOtpRequired = true;
    let devOtp: string | undefined;
    try {
      const issued = await issueEmailOtp({ userId: user.id, email: user.email });
      devOtp = issued.code; // always capture — gated on isDevFallbackAllowed at response
    } catch (err) {
      console.error("[register] OTP issue error:", err);
      // Generate a local fallback OTP so dev mode tests always work
      if (isDevFallbackAllowed()) {
        devOtp = String(Math.floor(100000 + Math.random() * 900000));
      }
    }

    // Never return secrets to the client: the password hash, the TOTP secret,
    // the (one-time) verification token, and the email-OTP hash — a SHA-256 of
    // a 6-digit code is trivially brute-forceable offline if it leaks.
    const SENSITIVE_USER_KEYS = new Set([
      "password",
      "totpSecret",
      "verificationToken",
      "verificationTokenExpires",
      "emailOtpHash",
      "emailOtpExpires",
      "emailOtpAttempts",
    ]);
    const safeUser = Object.fromEntries(
      Object.entries(user).filter(([key]) => !SENSITIVE_USER_KEYS.has(key)),
    );

    const response = NextResponse.json({
      token,
      user: safeUser,
      message: "Account created successfully",
      emailOtpRequired,
      ...(isDevFallbackAllowed() && devOtp ? { devOtp } : {}), // devOtp gated: only in non-production
    });

    setAuthCookies(response, token, refreshToken);

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "An error occurred during registration" }, { status: 500 });
  }
}
