import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/affiliates/links
 * Lists affiliate links with click/conversion/commission stats.
 */
export async function GET(req: Request) {
  const { response } = await requirePermission("read", "affiliates", req);
  if (response) return response;

  const links = await prisma.affiliateLink.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, name: true, price: true, image: true } },
      platform: { select: { id: true, name: true, slug: true, color: true } },
      _count: { select: { clicks: true, conversions: true } },
      conversions: { select: { amount: true, commissionAmount: true, status: true } },
    },
  });

  const result = links.map((l) => {
    const revenue = l.conversions.reduce((s, c) => s + c.amount, 0);
    const commission = l.conversions
      .filter((c) => c.status !== "REJECTED")
      .reduce((s, c) => s + c.commissionAmount, 0);
    const { conversions, ...rest } = l;
    void conversions;
    return { ...rest, stats: { revenue, commission } };
  });

  return NextResponse.json(result);
}

/**
 * POST /api/affiliates/links
 * Creates an affiliate link for a product on a platform.
 * Body: { productId, platformId, commissionType?, commissionValue?, targetUrl? }
 */
export async function POST(req: Request) {
  const { response } = await requirePermission("create", "affiliates", req);
  if (response) return response;

  const body = await req.json();
  const { productId, platformId } = body;
  if (!productId || !platformId) {
    return NextResponse.json({ error: "productId and platformId are required" }, { status: 400 });
  }

  const [product, platform] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.affiliatePlatform.findUnique({
      where: { id: platformId },
      include: { connection: true },
    }),
  ]);
  if (!product || !platform) {
    return NextResponse.json({ error: "Product or platform not found" }, { status: 404 });
  }

  const commissionType = body.commissionType === "FIXED" ? "FIXED" : "PERCENTAGE";
  const commissionValue = parseFloat(body.commissionValue);
  if (isNaN(commissionValue) || commissionValue < 0) {
    return NextResponse.json({ error: "Invalid commission value" }, { status: 400 });
  }

  // Destination: explicit target URL, or built from the platform storefront
  const storeBase = platform.connection?.storeUrl || platform.baseUrl || "";
  const targetUrl = (body.targetUrl as string) || `${storeBase.replace(/\/$/, "")}/${product.slug}`;

  const code = crypto.randomBytes(4).toString("hex");

  const link = await prisma.affiliateLink.create({
    data: {
      code,
      productId,
      platformId,
      targetUrl,
      commissionType,
      commissionValue,
    },
    include: {
      product: { select: { id: true, name: true, price: true } },
      platform: { select: { id: true, name: true, slug: true, color: true } },
    },
  });

  const { session } = await requireAuth(req);
  await prisma.activityLog.create({
    data: {
      action: "CREATE_AFFILIATE_LINK",
      entity: "AffiliateLink",
      entityId: link.id,
      details: `Affiliate link ${code} for ${product.name} on ${platform.name}`,
      userId: session.user.id,
    },
  });

  return NextResponse.json(link);
}
