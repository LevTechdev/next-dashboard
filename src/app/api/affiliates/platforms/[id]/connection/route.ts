import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";
import { getConnector } from "@/lib/platform-connectors";

export const dynamic = "force-dynamic";

/**
 * PUT /api/affiliates/platforms/[id]/connection
 * Saves credentials for a platform and validates them against the real
 * platform API. Status becomes CONNECTED when the test call succeeds.
 * Body: { apiKey?, apiSecret?, accessToken?, shopId?, storeUrl? }
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePermission("update", "affiliates", req);
  if (response) return response;

  const { id } = await params;
  const body = await req.json();

  const platform = await prisma.affiliatePlatform.findUnique({
    where: { id },
    include: { connection: true },
  });
  if (!platform) {
    return NextResponse.json({ error: "Platform not found" }, { status: 404 });
  }

  // Merge new credentials over existing ones (empty string clears a field)
  const merged = {
    apiKey: body.apiKey !== undefined ? body.apiKey || null : (platform.connection?.apiKey ?? null),
    apiSecret:
      body.apiSecret !== undefined
        ? body.apiSecret || null
        : (platform.connection?.apiSecret ?? null),
    accessToken:
      body.accessToken !== undefined
        ? body.accessToken || null
        : (platform.connection?.accessToken ?? null),
    shopId: body.shopId !== undefined ? body.shopId || null : (platform.connection?.shopId ?? null),
    storeUrl:
      body.storeUrl !== undefined ? body.storeUrl || null : (platform.connection?.storeUrl ?? null),
  };

  // Validate against the real platform API
  const connector = getConnector(platform.slug);
  let status = "DISCONNECTED";
  let lastError: string | null = null;
  if (connector) {
    const test = await connector.testConnection(merged);
    status = test.ok ? "CONNECTED" : "ERROR";
    lastError = test.ok ? null : test.error || "Connection test failed";
  } else {
    lastError = "No connector implemented for this platform";
  }

  const connection = await prisma.platformConnection.upsert({
    where: { platformId: id },
    create: { platformId: id, ...merged, status, lastError },
    update: { ...merged, status, lastError },
  });

  const { session } = await requireAuth(req);
  await prisma.activityLog.create({
    data: {
      action: "UPDATE_PLATFORM_CONNECTION",
      entity: "PlatformConnection",
      entityId: connection.id,
      details: `${platform.name} connection updated (${status})`,
      userId: session.user.id,
      tenantId: session.user.tenantId,
    },
  });

  // Do not return secrets
  const { apiSecret, accessToken, ...safe } = connection;
  void apiSecret;
  void accessToken;
  return NextResponse.json(safe);
}

/**
 * DELETE /api/affiliates/platforms/[id]/connection
 * Disconnects the platform (removes stored credentials).
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePermission("delete", "affiliates", req);
  if (response) return response;

  const { id } = await params;
  await prisma.platformConnection.deleteMany({ where: { platformId: id } });
  return NextResponse.json({ success: true });
}
