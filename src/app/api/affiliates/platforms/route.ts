import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { DEFAULT_PLATFORMS } from "@/lib/platform-connectors";

export const dynamic = "force-dynamic";

/**
 * GET /api/affiliates/platforms
 * Lists affiliate platforms with connection status and link counts.
 * Auto-seeds the default platform catalog on first use.
 */
export async function GET(req: Request) {
  const { response } = await requirePermission("read", "affiliates", req);
  if (response) return response;

  const count = await prisma.affiliatePlatform.count();
  if (count === 0) {
    await prisma.affiliatePlatform.createMany({
      data: DEFAULT_PLATFORMS,
      skipDuplicates: true,
    });
  }

  const platforms = await prisma.affiliatePlatform.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      connection: {
        select: {
          id: true,
          status: true,
          shopId: true,
          storeUrl: true,
          lastSyncAt: true,
          lastError: true,
          productsSynced: true,
          // never expose apiSecret / accessToken to the client
          apiKey: true,
        },
      },
      _count: { select: { links: true } },
    },
  });

  return NextResponse.json(platforms);
}
