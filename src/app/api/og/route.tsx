import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site-config";

export const runtime = "nodejs";

/**
 * Dynamic marketing OG image generator (1200×630).
 *
 *   /api/og?title=Pricing&subtitle=Simple%2C%20transparent%20plans
 *
 * Each marketing page wrapper passes its route title, so social shares get a
 * distinct branded card instead of every route reusing the dashboard capture.
 * The dashboard capture (/api/og/dashboard) remains the default/root OG image.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? SITE_NAME).slice(0, 80);
  const subtitle = (searchParams.get("subtitle") ?? SITE_TAGLINE).slice(0, 120);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "linear-gradient(135deg, #0b0c11 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "linear-gradient(135deg, #10b981, #3b82f6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          N
        </div>
        <div style={{ fontSize: 30, fontWeight: 600, opacity: 0.85 }}>{SITE_NAME}</div>
      </div>
      <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
      <div style={{ fontSize: 36, opacity: 0.7, marginTop: 24, maxWidth: 900 }}>{subtitle}</div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    },
  );
}
