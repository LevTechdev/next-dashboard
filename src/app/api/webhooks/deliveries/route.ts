import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { response } = await requirePermission("read", "integrations");
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const endpointId = searchParams.get("endpointId");

  const where = endpointId ? { endpointId } : {};

  const deliveries = await prisma.webhookDelivery.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      endpoint: { select: { name: true, url: true } },
    },
  });

  return NextResponse.json(deliveries);
}
