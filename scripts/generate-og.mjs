/**
 * Build-time OG regeneration hook.
 *
 * Renders the 1200×630 dashboard command panel to `public/og/dashboard.png`
 * using `sharp` SVG rasterization — no server, no Chromium. The route at
 * `/api/og/dashboard` serves this persisted PNG directly, so the very first
 * page paint never pays the browser-launch cost. Wired via the `prebuild`
 * npm script (runs automatically before `next build`).
 *
 *   npm run generate:og     → regenerate manually
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const builderPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/lib/og-dashboard.mjs",
);
const { buildDashboardSvg } = await import(pathToFileURL(builderPath).href);

const OUT_DIR = path.join(process.cwd(), "public", "og");
const OUT_FILE = path.join(OUT_DIR, "dashboard.png");

await fs.mkdir(OUT_DIR, { recursive: true });
const png = await sharp(Buffer.from(buildDashboardSvg())).png().toBuffer();
await fs.writeFile(OUT_FILE, png);

console.log(
  `[generate-og] wrote ${OUT_FILE} (${(png.length / 1024).toFixed(1)} KB, ${png.width}×${png.height})`,
);
