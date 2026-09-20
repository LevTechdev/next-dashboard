import { NextResponse } from "next/server";
import { generateDashboardOg, regenerateDashboardOgNow } from "@/lib/og-dashboard-server.mjs";
import { requireAuth } from "@/lib/api-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * OG-quality dashboard screenshot export.
 *
 * GET  → the 1200×630 dashboard command panel PNG. Serves the persisted build
 *        artifact first (`scripts/generate-og.mjs` → `public/og/dashboard.png`)
 *        so first paint never pays the Chromium launch cost; falls back to a
 *        fresh render (Playwright, sharp fallback) that persists the result.
 *        Logged-in viewers see their real /api/dashboard numbers; anonymous
 *        visitors get the demo series.
 *
 * POST → regeneration webhook. Re-renders against live data and refreshes the
 *        disk/memory caches immediately, instead of waiting for the 24h TTL.
 *        Auth-guarded; called by the order/product/customer mutation routes
 *        (fire-and-forget) and available for external webhook consumers.
 */

export async function GET(req: Request) {
  try {
    const { png } = await generateDashboardOg({ cookie: req.headers.get("cookie") });
    return pngResponse(png);
  } catch {
    return NextResponse.json(
      { error: "Dashboard screenshot renderer unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  const { response } = await requireAuth(req);
  if (response) return response;

  try {
    const { png, source } = await regenerateDashboardOgNow(req.headers.get("cookie"));
    return NextResponse.json({
      ok: true,
      bytes: png.length,
      source,
      regeneratedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Dashboard screenshot renderer unavailable" },
      { status: 503 },
    );
  }
}

function pngResponse(png: Buffer) {
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=600, s-maxage=600",
      "Content-Length": String(png.length),
    },
  });
}
