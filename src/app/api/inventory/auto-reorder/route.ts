import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { normalizeRole } from "@/lib/permissions";
import { runSchedulerJob } from "@/lib/scheduler";
import { runAutoReorder } from "@/lib/inventory-auto-reorder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET  — evaluate without side effects is not supported (the engine writes
 *        drafts directly); use GET on /api/inventory/replenishment to preview
 *        which products would trip.
 * POST — run the auto-reorder job now: draft DRAFT purchase orders for every
 *        active product at/below its velocity-based reorder point
 *        (cooldown-guarded per product, so repeat calls are safe).
 *
 * Admin-only, same guard as /api/affiliates/auto-payout.
 */
export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (normalizeRole(user?.role) !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // { force: true } ignores the per-product cooldown ledger — used by e2e
    // specs (and impatient admins) to produce a deterministic draft set.
    const body = await req.json().catch(() => ({}) as { force?: boolean });
    const force = (body as { force?: boolean })?.force === true;
    const result = force
      ? await runAutoReorder(new Date(), { force: true })
      : await runSchedulerJob("auto-reorder");
    return NextResponse.json(result);
  } catch (error) {
    console.error("Auto-reorder error:", error);
    return NextResponse.json({ error: "Failed to run auto-reorder" }, { status: 500 });
  }
}
