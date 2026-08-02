import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";
import { fetchProductFromUrl, detectPlatform } from "@/lib/product-link-parser";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "product";

/**
 * GET /api/affiliates/import-link?url=...
 * Preview only: fetches real product data from the pasted marketplace URL
 * (no DB writes) so the UI can show the image / name / price before saving.
 */
export async function GET(req: Request) {
  const { response } = await requirePermission("read", "affiliates", req);
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url") || "";
  if (!url) {
    return NextResponse.json({ error: "url query parameter is required" }, { status: 400 });
  }

  const slug = detectPlatform(url);
  const platform = slug
    ? await prisma.affiliatePlatform.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true, color: true, headlessEnabled: true },
      })
    : null;

  const result = await fetchProductFromUrl(url, {
    allowHeadless: platform?.headlessEnabled ?? true,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, platformSlug: result.platformSlug },
      { status: 422 },
    );
  }

  return NextResponse.json({ product: result.product, platform });
}

/**
 * POST /api/affiliates/import-link
 * Creates a product (from the real fetched data, with user overrides allowed)
 * and an affiliate link that points to the original marketplace URL.
 * Body: { url, commissionType?, commissionValue?, name?, price?, image?, description? }
 */
export async function POST(req: Request) {
  const { response } = await requirePermission("create", "affiliates", req);
  if (response) return response;

  const body = await req.json();
  const url = (body.url as string)?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const platformSlug = detectPlatform(url);
  if (!platformSlug) {
    return NextResponse.json(
      { error: "Unsupported link. Use Shopee, TikTok Shop, Instagram, Lazada, or Tokopedia." },
      { status: 400 },
    );
  }

  const platform = await prisma.affiliatePlatform.findUnique({ where: { slug: platformSlug } });
  if (!platform) {
    return NextResponse.json({ error: "Platform not configured" }, { status: 404 });
  }

  // Fetch real data (respecting the platform's headless setting), then apply
  // any user overrides from the preview step.
  const fetched = await fetchProductFromUrl(url, { allowHeadless: platform.headlessEnabled });
  const data = fetched.product;

  const name = (body.name as string)?.trim() || data?.name;
  if (!name) {
    return NextResponse.json(
      { error: fetched.error || "Could not resolve product name; please enter it manually." },
      { status: 422 },
    );
  }
  const price =
    body.price !== undefined && body.price !== "" ? parseFloat(body.price) : (data?.price ?? 0);
  // Full image gallery fetched from the product page (deduped).
  const gallery: string[] = Array.from(
    new Set(
      (Array.isArray(body.images) ? (body.images as string[]) : data?.images || []).filter(
        (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u),
      ),
    ),
  ).slice(0, 12);
  // Cover image: explicit override, else first gallery image, else fetched single.
  const image = (body.image as string) || gallery[0] || data?.image || null;
  if (image && !gallery.includes(image)) gallery.unshift(image);
  const description = (body.description as string) || data?.description || null;
  const externalId = data?.externalId || crypto.randomBytes(4).toString("hex");
  const sku = `${platformSlug}-${externalId}`;

  // Reuse an existing imported product (same platform + external id), else create.
  let product = await prisma.product.findFirst({ where: { sku } });
  if (product) {
    product = await prisma.product.update({
      where: { id: product.id },
      data: {
        name,
        price: isNaN(price) ? product.price : price,
        image: image ?? product.image,
        images: gallery.length ? gallery : product.images,
        description: description ?? product.description,
      },
    });
  } else {
    product = await prisma.product.create({
      data: {
        name,
        slug: `${slugify(name)}-${Date.now().toString(36)}`,
        price: isNaN(price) ? 0 : price,
        stock: data?.stock ?? 0,
        image,
        images: gallery,
        description,
        sku,
      },
    });
  }

  const commissionType = body.commissionType === "FIXED" ? "FIXED" : "PERCENTAGE";
  const commissionValue =
    body.commissionValue !== undefined ? parseFloat(body.commissionValue) : 10;

  const code = crypto.randomBytes(4).toString("hex");
  const link = await prisma.affiliateLink.create({
    data: {
      code,
      productId: product.id,
      platformId: platform.id,
      targetUrl: data?.url || url,
      commissionType,
      commissionValue: isNaN(commissionValue) ? 10 : commissionValue,
    },
    include: {
      product: { select: { id: true, name: true, price: true, image: true } },
      platform: { select: { id: true, name: true, slug: true, color: true } },
    },
  });

  const { session } = await requireAuth(req);
  await prisma.activityLog.create({
    data: {
      action: "IMPORT_AFFILIATE_LINK",
      entity: "AffiliateLink",
      entityId: link.id,
      details: `Imported ${name} from ${platform.name} (source: ${data?.source || "manual"})`,
      userId: session.user.id,
    },
  });

  return NextResponse.json({
    link,
    source: data?.source || "manual",
    fetchTier: data?.fetchTier || "manual",
    partial: data?.partial ?? true,
  });
}
