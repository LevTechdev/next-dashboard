import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword, needsRehash, signToken, type AuthUser } from "@/lib/auth";
import { spendBackupTotp, spendPrimaryTotp } from "@/lib/totp-replay";
import { createSession } from "@/lib/sessions";
import { newFamilyId, createRefreshToken } from "@/lib/refresh-tokens";
import { setAuthCookies } from "@/lib/auth-cookies";
import { consumeBackupCode, countUnusedBackupCodes } from "@/lib/backup-codes";
import { warnOnLowBackupCodes } from "@/lib/backup-code-alerts";
import { logSecurityEvent } from "@/lib/security-events";
import { sendNewSignInAlert } from "@/lib/security-notifications";
import { recognizeSessionContext } from "@/lib/device-recognition";
import { getRequestMeta } from "@/lib/request-meta";
import {
  checkLoginRateLimit,
  loginThrottleLimit,
  requestThrottleLimitOverride,
} from "@/lib/rate-limit";
import { issueEmailOtp, isDevFallbackAllowed } from "@/lib/email-verification";
import { verifyOtp, isOtpExpired, MAX_OTP_ATTEMPTS } from "@/lib/email-otp";
import {
  findTrustedDevice,
  issueTrustToken,
  trustCookieOptions,
  TRUST_COOKIE,
} from "@/lib/trusted-devices";
import { consumeSecondFactorMarker, PASSKEY_2FA_COOKIE } from "@/lib/passkey-second-factor";

export const dynamic = "force-dynamic";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

/**
 * Verify an emailed login-challenge OTP against the user's stored hash.
 * Mirrors the verify-email flow's protections (TTL, attempt cap, wipe on
 * exhaustion) but authenticates a sign-in instead of marking the address
 * verified. Returns `{ ok: true }` or a localized-key-ready failure.
 */
async function verifyLoginEmailOtp(
  user: {
    id: string;
    tenantId: string | null;
    emailOtpHash: string | null;
    emailOtpExpires: Date | null;
    emailOtpAttempts: number;
  },
  code: string,
  req: Request,
): Promise<{ ok: true } | { ok: false; error: string; attemptsLeft?: number }> {
  if (!user.emailOtpHash) return { ok: false, error: "OTP_NOT_REQUESTED" };

  if (isOtpExpired(user.emailOtpExpires)) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailOtpHash: null, emailOtpExpires: null, emailOtpAttempts: 0 },
    });
    return { ok: false, error: "OTP_EXPIRED" };
  }

  if (user.emailOtpAttempts >= MAX_OTP_ATTEMPTS) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailOtpHash: null, emailOtpExpires: null, emailOtpAttempts: 0 },
    });
    return { ok: false, error: "OTP_TOO_MANY_ATTEMPTS" };
  }

  if (!verifyOtp(code, user.emailOtpHash)) {
    const attempts = user.emailOtpAttempts + 1;
    const exhausted = attempts >= MAX_OTP_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailOtpAttempts: attempts,
        ...(exhausted ? { emailOtpHash: null, emailOtpExpires: null } : {}),
      },
    });
    await logSecurityEvent({
      userId: user.id,
      type: "LOGIN_FAILED",
      req,
      metadata: { method: "email_otp", attempt: attempts },
      tenantId: user.tenantId,
    });
    return {
      ok: false,
      error: "OTP_INVALID",
      attemptsLeft: exhausted ? 0 : MAX_OTP_ATTEMPTS - attempts,
    };
  }

  // Consumed on success — one challenge, one sign-in.
  await prisma.user.update({
    where: { id: user.id },
    data: { emailOtpHash: null, emailOtpExpires: null, emailOtpAttempts: 0 },
  });
  return { ok: true };
}

export async function POST(req: Request) {
  try {
    console.log("parsing body");
    const body = await req.json();
    const {
      email,
      password,
      totpToken,
      backupCode,
      emailOtpCode,
      challengeEmailOtp,
      passkeyAsserted,
      trustDevice,
      locale,
    } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // Per-IP sliding-window throttle (persisted in SecurityEvent so it holds
    // across instances). Runs before password verification — rejected IPs
    // never reach Argon2id. Fires-and-records even when blocked, so the
    // window keeps filling under hammering.
    const rl = await checkLoginRateLimit(req, {
      email: String(email).toLowerCase(),
      // An E2E spec may pin its own window (never honoured in production);
      // otherwise the suite-wide budget applies.
      limit: requestThrottleLimitOverride(req) ?? loginThrottleLimit(),
    });
    if (!rl.allowed) {
      // Attribute the throttle to the targeted account (by email) so its owner
      // sees the pressure in the Security Center telemetry card. Unattributed
      // rows are invisible there — the events feed is user-scoped.
      const target = await prisma.user.findUnique({
        where: { email: String(email).toLowerCase() },
        select: { id: true, tenantId: true },
      });
      if (target) {
        await logSecurityEvent({
          userId: target.id,
          type: "RATE_LIMITED",
          req,
          metadata: { blocked: true, endpoint: "login", via: "throttle-window" },
          tenantId: target.tenantId,
        });
      }
      return NextResponse.json(
        {
          error: `Too many login attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).`,
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }

    console.log("finding user");
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
    console.log("verifying password");
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

    // ── "This wasn't me" lockdown ──
    // Set by the alert's revoke link: the account was recovered by someone,
    // and whoever did it knows this password. Sessions were already revoked,
    // but the ONLY thing that keeps them out is refusing sign-in until the
    // password is replaced — otherwise they would just sign in again.
    if (user.passwordResetRequired) {
      await logSecurityEvent({
        userId: user.id,
        type: "LOGIN_FAILED",
        req,
        metadata: { reason: "password_reset_required" },
        tenantId: user.tenantId,
      });
      return NextResponse.json(
        { error: "PASSWORD_RESET_REQUIRED", code: "PASSWORD_RESET_REQUIRED" },
        { status: 403 },
      );
    }

    // ── Trusted device ──
    // A device the user trusted for 30 days while completing a second factor
    // skips the second factor entirely (GitHub/Google model). The check is
    // bound to the current device+browser profile inside findTrustedDevice,
    // so a stolen cookie does nothing on other machines. Trust never applies
    // to the email-challenge issuance below — that requests a factor, it does
    // not verify one.
    const trusted = await findTrustedDevice(req, user.id);
    const trustRequested = trustDevice === true;
    if (trusted && user.totpEnabled) {
      await logSecurityEvent({
        userId: user.id,
        type: "MFA_VERIFIED",
        req,
        metadata: { method: "trusted_device", trustedDeviceId: trusted.device.id },
        tenantId: user.tenantId,
      });
      // Fall through to session issuance with the second factor satisfied.
    }

    // ── Verification-method chooser ──
    // A user with 2FA enabled may authenticate the second factor either with
    // their authenticator app (TOTP / backup code) or with an emailed OTP.
    // `challengeEmailOtp: true` asks for an email challenge instead: the
    // password has ALREADY been verified at this point, so issuing the code is
    // safe — the session is only granted once the code comes back and passes.
    if (!totpToken && !backupCode && !emailOtpCode && challengeEmailOtp === true) {
      const { sent, code } = await issueEmailOtp({
        userId: user.id,
        email: user.email,
        locale,
      });
      await logSecurityEvent({
        userId: user.id,
        type: "EMAIL_DELIVERY_SENT",
        req,
        metadata: { purpose: "login_challenge", sent },
        tenantId: user.tenantId,
      });
      return NextResponse.json(
        {
          requires2FA: true,
          method: "email_otp",
          emailSent: sent,
          // Dev fallback (no mailer): surface the code inline so the flow stays
          // testable — same contract as the register flow's devOtp.
          ...(isDevFallbackAllowed() && !sent ? { devOtp: code } : {}),
        },
        { status: 200 },
      );
    }

    // 2FA: accept a TOTP code, a single-use backup code, an emailed OTP, or a
    // passkey assertion verified by the WebAuthn endpoint in second-factor
    // mode. Skipped entirely when the request came from a trusted device.
    // Set when a recovery code completed this sign-in, so the client can warn
    // that the set is running out (see the response below).
    let backupCodesRemaining: number | undefined;

    if (user.totpEnabled && user.totpSecret && !trusted) {
      if (!totpToken && !backupCode && !emailOtpCode && !passkeyAsserted) {
        // Report whether the user has registered passkeys so the chooser can
        // offer the passkey card (phishing-resistant, cheapest second factor).
        const passkeyCount = await prisma.webAuthnCredential.count({
          where: { userId: user.id },
        });
        return NextResponse.json(
          {
            requires2FA: true,
            method: "totp",
            message: "TOTP verification code required",
            hasPasskeys: passkeyCount > 0,
          },
          { status: 200 },
        );
      }
      // Emailed-OTP path: same hashed comparison + attempt caps as the
      // verify-email flow, but it authenticates the sign-in (MFA_VERIFIED)
      // instead of marking the address verified.
      // Passkey-as-second-factor: the assertion was already cryptographically
      // verified by /api/auth/webauthn/authenticate/verify in second-factor
      // mode, which stashed a short-lived signed marker cookie. Verify and
      // consume it here — one marker, one sign-in.
      if (passkeyAsserted) {
        const marker = await consumeSecondFactorMarker(req, user.id);
        if (!marker.ok) {
          return NextResponse.json({ error: marker.error }, { status: 401 });
        }
        await logSecurityEvent({
          userId: user.id,
          type: "MFA_VERIFIED",
          req,
          metadata: { method: "passkey" },
          tenantId: user.tenantId,
        });
        // Fall through to session issuance.
      } else if (emailOtpCode) {
        const emailPassed = await verifyLoginEmailOtp(user, emailOtpCode, req);
        if (!emailPassed.ok) {
          return NextResponse.json(
            {
              error: emailPassed.error,
              ...(emailPassed.attemptsLeft !== undefined
                ? { attemptsLeft: emailPassed.attemptsLeft }
                : {}),
            },
            { status: 401 },
          );
        }
        await logSecurityEvent({
          userId: user.id,
          type: "MFA_VERIFIED",
          req,
          metadata: { method: "email_otp" },
          tenantId: user.tenantId,
        });
        // Fall through to session issuance — emailPassed.ok means continue.
      } else {
        let passed = false;
        // Single-use guard: the code is claimed against the primary secret's
        // replay counter, so a code observed and reused inside its own 30-second
        // step is refused (RFC 6238 §5.2). `replayed` distinguishes "wrong code"
        // from "already used" for the error below.
        let replayed = false;
        if (totpToken) {
          const primary = await spendPrimaryTotp(user.id, totpToken);
          passed = primary.ok;
          // Sticky: the spare is tried with the same code, and its verdict on an
          // already-spent code would be a plain "invalid" that overwrites the
          // more useful answer. Once any secret reports a replay, say so.
          if (!primary.ok && primary.reason === "REPLAY") replayed = true;
          if (passed) {
            await logSecurityEvent({
              userId: user.id,
              type: "MFA_VERIFIED",
              req,
              metadata: { method: "totp" },
              tenantId: user.tenantId,
            });
          } else {
            // A SECOND enrolled authenticator (spare device) is accepted at
            // this exact step. It is tried only after the primary secret
            // failed, so the common path costs no extra query, and the user
            // never has to know which device they are holding — they just type
            // the code. This is what makes a lost phone stop escalating to an
            // emailed account recovery (which would turn 2FA off entirely).
            const backup = await spendBackupTotp(user.id, totpToken);
            passed = backup.ok;
            if (!backup.ok && backup.reason === "REPLAY") replayed = true;
            if (backup.ok) {
              await logSecurityEvent({
                userId: user.id,
                type: "MFA_VERIFIED",
                req,
                metadata: { method: "totp_backup" },
                tenantId: user.tenantId,
              });
            }
          }
        }
        if (!passed && backupCode) {
          passed = await consumeBackupCode(user.id, backupCode);
          if (passed) {
            await logSecurityEvent({
              userId: user.id,
              type: "BACKUP_CODE_USED",
              req,
              tenantId: user.tenantId,
            });
            await logSecurityEvent({
              userId: user.id,
              type: "MFA_VERIFIED",
              req,
              metadata: { method: "backup_code" },
              tenantId: user.tenantId,
            });
            // Recovery codes are a finite resource: report what is left so the
            // recovery step can warn before the set hits zero, and raise the
            // in-app alert when it does.
            backupCodesRemaining = await countUnusedBackupCodes(user.id);
            await warnOnLowBackupCodes(user.id, backupCodesRemaining);
          }
        }
        if (!passed) {
          // A replay is not a wrong code: telling the user to wait for the next
          // one is actionable, telling them "invalid" invites a retry loop with
          // the very value that will keep failing.
          if (replayed) {
            await logSecurityEvent({
              userId: user.id,
              type: "MFA_CODE_REPLAYED",
              req,
              tenantId: user.tenantId,
            });
            return NextResponse.json(
              {
                error: "That code was already used. Wait for your app to show a new one.",
                code: "TOTP_REPLAY",
              },
              { status: 401 },
            );
          }
          return NextResponse.json(
            { error: "Invalid two-factor authentication code" },
            { status: 401 },
          );
        }
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

    // Account-protection alert: recognize the device/IP against the user's
    // session history BEFORE this sign-in's own session row exists — the
    // alert must fire on genuinely new devices, and querying after the insert
    // would let every sign-in "recognize itself". Best-effort, never blocks.
    const recognition = await recognizeSessionContext(user.id, getRequestMeta(req));

    // Per-device session + refresh-token family (Phase 2 rotation).
    const familyId = newFamilyId();
    const sessionId = await createSession({ userId: user.id, token, req, familyId });
    const refreshToken = await createRefreshToken(user.id, familyId, sessionId);
    await logSecurityEvent({ userId: user.id, type: "LOGIN", req, tenantId: user.tenantId });
    // Email the user ONLY when this sign-in is not recognized — a device
    // profile (OS+browser) or IP the account hasn't used in the last 90 days.
    void sendNewSignInAlert({
      to: user.email,
      req,
      userId: user.id,
      locale,
      recognition,
      onDecision: (outcome) => console.log(`[sign-in-alert] outcome=${outcome}`),
    });

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
      message: "Login successful",
      // Only present when this sign-in consumed a recovery code.
      ...(backupCodesRemaining !== undefined ? { backupCodesRemaining } : {}),
    });

    setAuthCookies(response, token, refreshToken);

    // Grant device trust only when the user asked for it while COMPLETING a
    // second factor (or signing in on an already-trusted device, where the
    // cookie simply gets its lifetime extended by a fresh token). Password-
    // only sign-ins never create trust.
    if (trustRequested && (trusted || user.totpEnabled)) {
      try {
        const { token: trustToken, expiresAt } = await issueTrustToken(user.id, req);
        response.cookies.set(TRUST_COOKIE, trustToken, trustCookieOptions(expiresAt));
      } catch (err) {
        console.error("trust-token issue failed:", err);
      }
    }
    // The passkey marker is single-use: clear it once the session is issued.
    if (passkeyAsserted) {
      response.cookies.set(PASSKEY_2FA_COOKIE, "", { path: "/", maxAge: 0 });
    }

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "An error occurred during login" }, { status: 500 });
  }
}
