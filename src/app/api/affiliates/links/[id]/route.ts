import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";

/**
 * PATCH /api/affiliates/links/[id]
 * Update commission or active state.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePermission("update", "affiliates", req);
  if (response) return response;

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.commissionType)
    data.commissionType = body.commissionType === "FIXED" ? "FIXED" : "PERCENTAGE";
  if (body.commissionValue !== undefined) {
    const v = parseFloat(body.commissionValue);
    if (isNaN(v) || v < 0) {
      return NextResponse.json({ error: "Invalid commission value" }, { status: 400 });
    }
    data.commissionValue = v;
  }
  if (body.targetUrl) data.targetUrl = body.targetUrl;

  const link = await prisma.affiliateLink.update({ where: { id }, data });
  return NextResponse.json(link);
}

/**
 * DELETE /api/affiliates/links/[id]
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePermission("delete", "affiliates", req);
  if (response) return response;

  const { id } = await params;
  await prisma.affiliateLink.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
