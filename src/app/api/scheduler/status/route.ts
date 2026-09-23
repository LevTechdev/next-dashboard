import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { normalizeRole } from "@/lib/permissions";
import { schedulerStatus } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/scheduler/status — scheduler health for the Settings indicator.
 *
 * Returns whether the in-app loop is enabled (SCHEDULER_ENABLED=1 or
 * production), the tick interval, and the last execution (time/outcome/
 * result) of each job: usage-digest, auto-payout, webhook-retry.
 */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (normalizeRole(user?.role) !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(schedulerStatus());
}
