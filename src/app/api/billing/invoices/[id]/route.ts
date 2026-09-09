import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requirePermission("update", "billing", req);
  if (response) return response;

  const { id } = await params;
  const { session } = await requireAuth(req);
  const userId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const targetStatus = body.status || "PAID";

  // Verify invoice exists and belongs to user
  const existing = await prisma.invoice.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: targetStatus,
      paidAt: targetStatus === "PAID" ? new Date() : existing.paidAt,
      paymentMethod: body.paymentMethod || existing.paymentMethod || "qris_instant",
    },
  });

  return NextResponse.json({ success: true, invoice: updated });
}
