import type { RingChannel } from "@/components/charts/channel-activity-rings";

/**
 * Shareable image export for the Channel Activity Rings.
 *
 * Renders the SAME ring geometry (tracks, progress arcs, channel palette,
 * stat tiles) into a standalone SVG string — no DOM, no rasterizer dep.
 * The file opens in any browser/design tool and stays crisp at any size
 * (true vector), which suits a "share" artifact better than a lossy PNG.
 *
 * Escaping: every dynamic string passes through esc() so a channel named
 * `<script>` can't break out of the document.
 */

const esc = (s: string) =>
  (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtMoney = (v: number) => "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });

export function buildRingsShareSvg(
  channels: RingChannel[],
  title: string,
  subtitle: string,
): string {
  const active = channels.filter((c) => (c.value || 0) > 0).slice(0, 3);
  const max = active.length ? Math.max(...active.map((c) => c.value)) : 0;
  const total = active.reduce((s, c) => s + c.value, 0);

  const W = 640;
  const H = 320;
  const cx = 170;
  const cy = 168;
  const radii = [104, 82, 60];
  const SW = 18;
  const CIRC = 2 * Math.PI;
  const COLORS = ["#71717a", "#a1a1aa", "#d4d4d8"];

  const rings = active.map((c, i) => ({
    ...c,
    progress: max > 0 ? c.value / max : 0,
    r: radii[i] ?? radii[2],
  }));

  const ringSvgs = rings
    .map((ring) => {
      const circ = CIRC * ring.r;
      const dash = circ * ring.progress;
      return `
  <circle cx="${cx}" cy="${cy}" r="${ring.r}" fill="none" stroke="rgba(113,113,122,0.25)" stroke-width="${SW}"/>
  <circle cx="${cx}" cy="${cy}" r="${ring.r}" fill="none" stroke="${esc(ring.color)}" stroke-width="${SW}"
    stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${(circ - dash).toFixed(1)}"
    transform="rotate(-90 ${cx} ${cy})"/>`;
    })
    .join("\n");

  const tiles = rings
    .map((ring, i) => {
      const share = total > 0 ? Math.round((ring.value / total) * 100) : 0;
      const tx = 344;
      const ty = 96 + i * 74;
      return `
  <g>
    <circle cx="${tx}" cy="${ty - 5}" r="5" fill="${esc(ring.color)}"/>
    <text x="${tx + 14}" y="${ty}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="13" font-weight="600" fill="#71717a">${esc(ring.name)}</text>
    <text x="${tx + 14}" y="${ty + 22}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="18" font-weight="700" fill="#18181b">${esc(fmtMoney(ring.value))}</text>
    <text x="${tx + 118}" y="${ty + 22}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="12" fill="#a1a1aa">${share}%</text>
  </g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="20" fill="#ffffff"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="19" fill="none" stroke="#e4e4e7" stroke-width="2"/>
  <text x="32" y="48" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="17" font-weight="700" fill="#09090b">${esc(title)}</text>
  <text x="32" y="68" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="12" fill="#71717a">${esc(subtitle)}</text>
  ${ringSvgs}
  ${tiles}
  <text x="32" y="${H - 20}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="10" fill="#a1a1aa">LevTech Unified Commerce</text>
</svg>`;
}

/** Trigger a client-side download of the share SVG. */
export function downloadRingsShare(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * PNG fallback — rasterize the share SVG via an off-screen <img> + canvas.
 * No external rasterizer dependency; the SVG is self-contained (inline
 * styles only), so it decodes as an image source. Accepts a scale factor
 * for retina-crisp output (default 2×). Falls back gracefully: if the
 * browser refuses (tainted canvas, decode failure) it returns false so the
 * caller can keep the SVG download as the artifact.
 */
export async function downloadRingsSharePng(
  svg: string,
  filename: string,
  width = 640,
  height = 320,
  scale = 2,
): Promise<boolean> {
  try {
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const img = new Image();
      img.decoding = "sync";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("svg decode failed"));
        img.src = svgUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return false;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  } catch {
    return false;
  }
}
