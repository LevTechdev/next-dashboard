import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/aff/[code]
 * Public affiliate redirect: records a click and 302-redirects to the
 * product URL on the target platform with UTM attribution parameters.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const link = await prisma.affiliateLink.findUnique({
    where: { code },
    include: { platform: { select: { slug: true } } },
  });

  if (!link || !link.isActive) {
    return NextResponse.json({ error: "Link not found or inactive" }, { status: 404 });
  }

  // Record click (hash IP for privacy; never store raw IPs)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);

  await prisma.affiliateClick.create({
    data: {
      linkId: link.id,
      ipHash,
      userAgent: req.headers.get("user-agent")?.slice(0, 250) || null,
      referrer: req.headers.get("referer")?.slice(0, 250) || null,
    },
  });

  // Redirect with attribution parameters
  let target: URL;
  try {
    target = new URL(link.targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid target URL" }, { status: 500 });
  }
  target.searchParams.set("utm_source", "affiliate");
  target.searchParams.set("utm_medium", link.platform.slug);
  target.searchParams.set("utm_campaign", link.code);

  return NextResponse.redirect(target.toString(), 302);
}
