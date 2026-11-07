import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const tenantId = await effectiveTenantId(session);
  if (!tenantId) {
    return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
  }

  const categories = await prisma.productCategory.findMany({
    where: { tenantId },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json(categories);
}
