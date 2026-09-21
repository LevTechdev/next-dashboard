import "server-only";

import { prisma } from "@/lib/db";
import { backupCodeStatus, BACKUP_CODE_LOW_THRESHOLD } from "@/lib/backup-code-status";

/**
 * Tell the user their recovery codes are running out — while they can still
 * do something about it.
 *
 * The warning fires the moment a code is spent and the remaining count lands
 * at or below {@link BACKUP_CODE_LOW_THRESHOLD}. It is an in-app alert (the
 * NOTIFICATIONS inbox, `alert` category, deep-linked to the Security Center)
 * because the moment it matters most — the user is signing in with a recovery
 * code — is also the moment an email is least likely to be read.
 *
 * Best-effort: never throws into the sign-in path, and deduped by title so
 * burning the last three codes doesn't stack three identical alerts.
 */
export async function warnOnLowBackupCodes(userId: string, remaining: number): Promise<void> {
  const status = backupCodeStatus(remaining);
  if (status !== "low" && status !== "exhausted") return;

  const title =
    status === "exhausted"
      ? "No backup recovery codes left"
      : `Only ${remaining} backup recovery code${remaining === 1 ? "" : "s"} left`;

  const description =
    status === "exhausted"
      ? "You have used every recovery code. Generate a new set now — without one, losing your authenticator locks you out."
      : `Each of the last ${BACKUP_CODE_LOW_THRESHOLD} codes gets used up by one sign-in. Generate a fresh set so you are never locked out.`;

  try {
    const already = await prisma.notification.findFirst({
      where: { userId, title },
      select: { id: true },
    });
    if (already) {
      // Refresh the visible count without stacking a second alert.
      await prisma.notification.update({
        where: { id: already.id },
        data: { description, read: false, readAt: null },
      });
      return;
    }

    await prisma.notification.create({
      data: {
        userId,
        type: "alert",
        title,
        description,
        link: "/security",
      },
    });
  } catch (err) {
    console.error("[backup-codes] low-code warning failed:", err);
  }
}
