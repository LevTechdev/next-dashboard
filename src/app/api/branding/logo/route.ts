import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";

/**
 * Logo asset intake for the white-label picker.
 *
 * Accepts the branding logo as either a raw SVG text body (`text/plain`) or a
 * data URL / remote URL reference (`application/json` with { url }). The SVG
 * path hardens the markup — strips <script>/<foreignObject> and event-handler
 * attributes — then re-serializes to a self-contained data URL, so the stored
 * logo renders offline in PDFs, invoices, and print layouts with no external
 * fetch. HTTP(S) URLs are returned unchanged (fetched by the browser like any
 * image); data URLs of any image type pass through with a size ceiling.
 *
 * Max asset size: 1MB (logos are vector/small — 10MB would be abusive here).
 */
const MAX_SVG_BYTES = 1024 * 1024;

function sanitizeSvg(svg: string): string | null {
  const trimmed = svg.trim();
  if (!trimmed.startsWith("<")) return null;
  if (!/<svg[\s>]/i.test(trimmed)) return null;

  return (
    trimmed
      // Executable or foreign content — removed wholesale.
      .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
      .replace(/<script[^>]*\/?>/gi, "")
      .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
      .replace(/<!DOCTYPE[^>]*>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      // Event handlers (on*) and javascript: hrefs — attribute-level XSS.
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
      .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
      .replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"')
      .replace(/href\s*=\s*'javascript:[^']*'/gi, "href='#'")
  );
}

export async function POST(req: Request) {
  const { response } = await requireAuth(req);
  if (response) return response;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { url?: string } | null;
    const url = body?.url?.trim();
    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }
    if (url.length > 2048) {
      return NextResponse.json({ error: "URL too long" }, { status: 400 });
    }
    const isData = /^data:image\/(svg\+xml|png|jpeg|jpg|webp|avif|gif);base64,/i.test(url);
    const isHttp = /^https?:\/\//i.test(url);
    if (!isData && !isHttp) {
      return NextResponse.json(
        { error: "Only http(s) URLs or image data URLs are accepted" },
        { status: 400 },
      );
    }
    if (isData && url.length > MAX_SVG_BYTES) {
      return NextResponse.json({ error: "Asset too large. Max 1MB" }, { status: 413 });
    }
    return NextResponse.json({ logoUrl: url, kind: isData ? "data" : "remote" });
  }

  // Raw SVG text (upload path: the file's text is POSTed directly).
  const raw = await req.text();
  if (!raw.length) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_SVG_BYTES) {
    return NextResponse.json({ error: "SVG too large. Max 1MB" }, { status: 413 });
  }
  const clean = sanitizeSvg(raw);
  if (!clean) {
    return NextResponse.json({ error: "Invalid SVG file" }, { status: 400 });
  }
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(clean, "utf8").toString("base64")}`;
  return NextResponse.json({ logoUrl: dataUrl, kind: "svg" });
}
