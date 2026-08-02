import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/affiliates/platforms/[id]
 * Updates per-platform settings. Currently supports:
 *  - headlessEnabled: allow/deny the Playwright headless fallback for imports
 *  - isActive: show/hide the platform
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePermission("update", "affiliates", req);
  if (response) return response;

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (typeof body.headlessEnabled === "boolean") data.headlessEnabled = body.headlessEnabled;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid settings provided" }, { status: 400 });
  }

  const platform = await prisma.affiliatePlatform.update({
    where: { id },
    data,
    select: { id: true, name: true, slug: true, headlessEnabled: true, isActive: true },
  });

  return NextResponse.json(platform);
}
