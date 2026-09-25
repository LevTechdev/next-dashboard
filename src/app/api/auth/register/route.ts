import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signToken, type AuthUser } from "@/lib/auth";
import { isPasswordBreached } from "@/lib/hibp";
import { createSession } from "@/lib/sessions";
import { newFamilyId, createRefreshToken } from "@/lib/refresh-tokens";
import { setAuthCookies } from "@/lib/auth-cookies";
import { logSecurityEvent } from "@/lib/security-events";
import { issueEmailOtp, isDevFallbackAllowed } from "@/lib/email-verification";
import { describeMailConfiguration } from "@/lib/email";
import { ensureStarterSubscription, provisionPersonalTenant } from "@/lib/provisioning";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password } = body;
    // Verification-email locale: sent by the client (the signup page knows it);
    // anything unsupported falls back to en inside the mailer.
    const locale = typeof body.locale === "string" ? body.locale : undefined;

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

    // Create user — self-service signups are always CLIENT; workspace roles
    // (STAFF/MANAGER/ADMIN) exist only when an ADMIN creates them in Team.
    const hashedPassword = await hashPassword(password);
    // Fresh signups get their OWN empty workspace (not the shared `default`
    // tenant) so the dashboard starts clean — $0 revenue, 0 orders — instead
    // of rendering the seed workspace's data to a brand-new account.
    const tenantId = await provisionPersonalTenant(name);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        passwordAlgo: "argon2id",
        passwordChangedAt: new Date(),
        role: "CLIENT",
        isActive: true,
        tenantId,
      },
    });

    // Tier system: every new signup lands on the Starter plan (REGULAR tier)
    // with an ACTIVE subscription so plan gating resolves on first login.
    await ensureStarterSubscription(user.id);

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
    let emailSent = false;
    let emailQueued = false;
    try {
      const issued = await issueEmailOtp({ userId: user.id, email: user.email, locale });
      emailSent = issued.sent;
      emailQueued = issued.queued;
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

    // A mail configuration that cannot reach real recipients (today: Resend's
    // sandbox sender, which only delivers to the account owner) must not be
    // reported as "we emailed you" — the user would wait for a message that the
    // provider rejected.
    const mailWarnings = describeMailConfiguration().warnings;

    const response = NextResponse.json({
      token,
      user: safeUser,
      message: "Account created successfully",
      emailOtpRequired,
      // `emailSent`: a configured transport accepted it during this call.
      // `emailQueued`: it is durably queued and will be retried until it is.
      // Together they let the UI tell "check your inbox" apart from "no mailer
      // configured" without ever promising an email that cannot arrive.
      emailSent,
      emailQueued,
      ...(mailWarnings.length ? { mailMisconfigured: true } : {}),
      ...(isDevFallbackAllowed() && devOtp ? { devOtp } : {}), // devOtp gated: only in non-production
    });

    setAuthCookies(response, token, refreshToken);

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "An error occurred during registration" }, { status: 500 });
  }
}
