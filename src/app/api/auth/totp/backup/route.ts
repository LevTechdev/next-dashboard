import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { resolveSessionUserId } from "@/lib/session-user";
import { logSecurityEvent } from "@/lib/security-events";
import {
  confirmBackupAuthenticator,
  getBackupAuthenticatorStatus,
  offerBackupAuthenticator,
  removeBackupAuthenticator,
} from "@/lib/backup-authenticator";
import { countUnusedBackupCodes } from "@/lib/backup-codes";
import { recoveryImpactOf } from "@/lib/recovery-readiness";

export const dynamic = "force-dynamic";

/**
 * /api/auth/totp/backup — the SECOND authenticator app.
 *
 *   GET     → mint a secret + QR to scan (nothing stored yet)
 *   POST    → { secret, token, label? } confirm with a live code, then persist
 *   DELETE  → remove it
 *
 * The recovery ladder for a lost phone was backup codes (a bearer string the
 * user may never have generated) or emailed account recovery (which disables
 * 2FA and signs every device out). A spare enrolled authenticator is strictly
 * better than both: it is the same factor the user already trusts, it works at
 * the same login step, and recovering with it never weakens the account.
 *
 * Enrollment is two-step on purpose — the secret is only stored after a code
 * generated from it verifies, so an abandoned scan leaves no half-registered
 * factor behind.
 */

async function currentUserId(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return { response, userId: null as string | null };
  // No "first admin" fallback: a stale session must never enroll a factor on
  // someone else's row.
  const userId = await resolveSessionUserId(session);
  if (!userId) {
    return {
      response: NextResponse.json({ error: "User not found" }, { status: 404 }),
      userId: null,
    };
  }
  return { response: null, userId };
}

/** Enrollment state for the Security Center card. */
export async function GET(req: Request) {
  const { response, userId } = await currentUserId(req);
  if (response) return response;

  const url = new URL(req.url);
  const wantsOffer = url.searchParams.get("offer") === "1";

  if (!wantsOffer) {
    return NextResponse.json(await getBackupAuthenticatorStatus(userId!));
  }

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { email: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const offer = await offerBackupAuthenticator({
    email: user.email,
    label: url.searchParams.get("label"),
  });
  const qrCode = await QRCode.toDataURL(offer.otpauth);

  return NextResponse.json({
    secret: offer.secret,
    otpauth: offer.otpauth,
    qrCode,
    label: offer.label,
  });
}

export async function POST(req: Request) {
  const { response, userId } = await currentUserId(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const result = await confirmBackupAuthenticator({
    userId: userId!,
    secret: typeof body.secret === "string" ? body.secret : "",
    token: typeof body.token === "string" ? body.token.trim() : "",
    label: body.label,
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.error === "INVALID_SECRET" ? "A secret is required" : "Invalid verification code",
        code: result.error,
      },
      { status: 400 },
    );
  }

  const row = await prisma.backupAuthenticator.findUnique({
    where: { userId: userId! },
    select: { label: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { tenantId: true },
  });

  await logSecurityEvent({
    userId: userId!,
    type: "BACKUP_AUTHENTICATOR_ADDED",
    req,
    tenantId: user?.tenantId ?? null,
    metadata: { label: row?.label ?? null },
  });

  return NextResponse.json({
    success: true,
    ...(await getBackupAuthenticatorStatus(userId!)),
  });
}

export async function DELETE(req: Request) {
  const { response, userId } = await currentUserId(req);
  if (response) return response;

  const existing = await prisma.backupAuthenticator.findUnique({
    where: { userId: userId! },
    select: { id: true },
  });

  // Removing the LAST way back in is refused unless the caller acknowledges it.
  // The client shows a warning and a checkbox, but a client is not an
  // enforcement point: without this, the guard would be decoration that any
  // direct DELETE could skip. Deeper recovery paths (a verified email) make the
  // action harmless, so the requirement only appears when it matters.
  const acknowledged = new URL(req.url).searchParams.get("acknowledge") === "1";
  if (existing && !acknowledged) {
    const impact = recoveryImpactOf(await recoveryFactsFor(userId!), "removeSpare");
    if (impact.requiresAcknowledgement) {
      return NextResponse.json(
        {
          error: "Removing this device would leave no way back into your account",
          code: "RECOVERY_ACKNOWLEDGEMENT_REQUIRED",
          after: impact.after.level,
        },
        { status: 428 },
      );
    }
  }

  await removeBackupAuthenticator(userId!);

  if (existing) {
    const user = await prisma.user.findUnique({
      where: { id: userId! },
      select: { tenantId: true },
    });
    await logSecurityEvent({
      userId: userId!,
      type: "BACKUP_AUTHENTICATOR_REMOVED",
      req,
      tenantId: user?.tenantId ?? null,
    });
  }

  return NextResponse.json({ success: true, ...(await getBackupAuthenticatorStatus(userId!)) });
}

/**
 * The readiness facts for the current account, assembled server-side.
 *
 * Deliberately the same shape the Security Center builds on the client, so a
 * server-side refusal and the dialog that warned about it agree on the verdict.
 */
async function recoveryFactsFor(userId: string) {
  const [user, spare, remaining] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        totpEnabled: true,
        emailVerified: true,
        _count: { select: { webauthnCredentials: true } },
      },
    }),
    prisma.backupAuthenticator.findUnique({ where: { userId }, select: { id: true } }),
    countUnusedBackupCodes(userId),
  ]);
  return {
    totpEnabled: user?.totpEnabled ?? null,
    spareEnrolled: Boolean(spare),
    backupRemaining: remaining,
    passkeyCount: user?._count?.webauthnCredentials ?? null,
    emailVerified: user?.emailVerified ? user.emailVerified.toISOString() : null,
  };
}
