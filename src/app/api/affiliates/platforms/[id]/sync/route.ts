import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";
import { getConnector } from "@/lib/platform-connectors";

export const dynamic = "force-dynamic";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * POST /api/affiliates/platforms/[id]/sync
 * Pulls products from the connected platform's real API and upserts them
 * into the local catalog (matched by SKU, created otherwise).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePermission("update", "affiliates", req);
  if (response) return response;

  const { id } = await params;
  const platform = await prisma.affiliatePlatform.findUnique({
    where: { id },
    include: { connection: true },
  });
  if (!platform) {
    return NextResponse.json({ error: "Platform not found" }, { status: 404 });
  }
  if (!platform.connection) {
    return NextResponse.json(
      { error: "Platform is not connected. Save credentials first." },
      { status: 400 },
    );
  }

  const connector = getConnector(platform.slug);
  if (!connector) {
    return NextResponse.json(
      { error: "No connector implemented for this platform" },
      { status: 400 },
    );
  }

  const result = await connector.fetchProducts(platform.connection);
  if (!result.ok) {
    await prisma.platformConnection.update({
      where: { platformId: id },
      data: { status: "ERROR", lastError: result.error },
    });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const products = result.products || [];
  let created = 0;
  let updated = 0;

  for (let i = 0; i < products.length; i++) {
    const rp = products[i];
    const existing = rp.sku ? await prisma.product.findFirst({ where: { sku: rp.sku } }) : null;
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { price: rp.price || existing.price, stock: rp.stock ?? existing.stock },
      });
      updated++;
    } else {
      await prisma.product.create({
        data: {
          name: rp.name,
          slug: `${slugify(rp.name)}-${Date.now().toString(36)}${i}`,
          price: rp.price || 0,
          stock: rp.stock || 0,
          sku: rp.sku || `${platform.slug}-${rp.externalId}`,
        },
      });
      created++;
    }
  }

  const connection = await prisma.platformConnection.update({
    where: { platformId: id },
    data: {
      status: "CONNECTED",
      lastError: null,
      lastSyncAt: new Date(),
      productsSynced: products.length,
    },
  });

  const { session } = await requireAuth(req);
  await prisma.activityLog.create({
    data: {
      action: "SYNC_PLATFORM_PRODUCTS",
      entity: "PlatformConnection",
      entityId: connection.id,
      details: `${platform.name}: ${products.length} products synced (${created} new, ${updated} updated)`,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ success: true, total: products.length, created, updated });
}
