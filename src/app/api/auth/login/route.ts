import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword, needsRehash, signToken, type AuthUser } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import { createSession } from "@/lib/sessions";
import { newFamilyId, createRefreshToken } from "@/lib/refresh-tokens";
import { setAuthCookies } from "@/lib/auth-cookies";
import { consumeBackupCode } from "@/lib/backup-codes";
import { logSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, totpToken, backupCode } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Account is deactivated" }, { status: 403 });
    }

    // Lockout: reject while locked.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Account temporarily locked. Try again in ${mins} minute(s).` },
        { status: 423 },
      );
    }

    // Verify password (Argon2id or legacy bcrypt).
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        },
      });
      await logSecurityEvent({
        userId: user.id,
        type: lock ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
        req,
        metadata: { email, attempt: failed },
        tenantId: user.tenantId,
      });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // 2FA: accept a TOTP code OR a single-use backup code.
    if (user.totpEnabled && user.totpSecret) {
      if (!totpToken && !backupCode) {
        return NextResponse.json(
          { requires2FA: true, message: "TOTP verification code required" },
          { status: 200 },
        );
      }
      let passed = false;
      if (totpToken) {
        passed = verifyTotp(totpToken, user.totpSecret);
        if (passed) {
          await logSecurityEvent({
            userId: user.id,
            type: "MFA_VERIFIED",
            req,
            metadata: { method: "totp" },
            tenantId: user.tenantId,
          });
        }
      }
      if (!passed && backupCode) {
        passed = await consumeBackupCode(user.id, backupCode);
        if (passed) {
          await logSecurityEvent({ userId: user.id, type: "BACKUP_CODE_USED", req, tenantId: user.tenantId });
          await logSecurityEvent({
            userId: user.id,
            type: "MFA_VERIFIED",
            req,
            metadata: { method: "backup_code" },
            tenantId: user.tenantId,
          });
        }
      }
      if (!passed) {
        return NextResponse.json(
          { error: "Invalid two-factor authentication code" },
          { status: 401 },
        );
      }
    }

    // Successful auth: reset lockout counters + transparently upgrade the hash.
    const updates: Record<string, unknown> = { failedLoginCount: 0, lockedUntil: null };
    if (needsRehash(user.password)) {
      updates.password = await hashPassword(password);
      updates.passwordAlgo = "argon2id";
    }
    await prisma.user.update({ where: { id: user.id }, data: updates });

    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
    const token = signToken(authUser);

    // Per-device session + refresh-token family (Phase 2 rotation).
    const familyId = newFamilyId();
    const sessionId = await createSession({ userId: user.id, token, req, familyId });
    const refreshToken = await createRefreshToken(user.id, familyId, sessionId);
    await logSecurityEvent({ userId: user.id, type: "LOGIN", req, tenantId: user.tenantId });

    const { password: _pw, totpSecret: _ts, ...safeUser } = user;
    void _pw;
    void _ts;

    const response = NextResponse.json({
      token,
      user: safeUser,
      message: "Login successful",
    });

    setAuthCookies(response, token, refreshToken);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "An error occurred during login" }, { status: 500 });
  }
}
