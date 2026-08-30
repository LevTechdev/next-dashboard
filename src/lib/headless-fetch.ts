/**
 * Headless-browser page renderer (Playwright) — the reliable fallback for the
 * affiliate URL importer when static HTTP fetching is blocked by anti-bot
 * shields or when a marketplace renders its product data with JavaScript.
 *
 * Playwright is an optional dependency, imported lazily so it never affects
 * the production build or serverless bundle (it's also listed in
 * `serverExternalPackages`). If the browser cannot launch — not installed, or
 * disabled via AFFILIATE_HEADLESS=0 — the caller degrades to manual entry.
 */

export interface HeadlessResult {
  ok: boolean;
  html?: string;
  finalUrl?: string;
  /** JSON bodies captured from matching API responses, keyed by response URL. */
  captured?: Record<string, unknown>;
  error?: string;
}

export interface RenderOptions {
  /** CSS selector to wait for before reading the DOM. */
  waitForSelector?: string;
  /** Response-URL substrings whose JSON body should be captured (e.g. product APIs). */
  captureUrlIncludes?: string[];
  timeoutMs?: number;
  userAgent?: string;
}

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Headless rendering is enabled unless explicitly turned off via env. */
export function isHeadlessEnabled(): boolean {
  const v = process.env.AFFILIATE_HEADLESS;
  return v !== "0" && v !== "false";
}

/**
 * Render a URL in headless Chromium and return the fully-rendered HTML plus any
 * captured product-API JSON. Always resolves (never throws) so callers can fall
 * back gracefully.
 */
export async function renderPage(url: string, opts: RenderOptions = {}): Promise<HeadlessResult> {
  if (!isHeadlessEnabled()) {
    return { ok: false, error: "Headless rendering is disabled (AFFILIATE_HEADLESS=0)" };
  }

  let chromium: any;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return {
      ok: false,
      error: "Playwright is not installed. Run: npx playwright install chromium",
    };
  }

  const timeoutMs = opts.timeoutMs ?? 25000;
  const captured: Record<string, unknown> = {};
  let browser: any = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: opts.userAgent || DEFAULT_UA,
      locale: "en-US",
      viewport: { width: 1366, height: 900 },
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9,id;q=0.8" },
    });
    const page = await context.newPage();

    if (opts.captureUrlIncludes?.length) {
      page.on("response", async (res: any) => {
        try {
          const u: string = res.url();
          if (!opts.captureUrlIncludes!.some((s) => u.includes(s))) return;
          const ct = (res.headers()["content-type"] || "") as string;
          if (ct.includes("application/json")) {
            captured[u] = await res.json();
          }
        } catch {
          /* ignore individual response parse errors */
        }
      });
    }

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    if (opts.waitForSelector) {
      await page.waitForSelector(opts.waitForSelector, { timeout: 8000 }).catch(() => {});
    } else {
      // Let client-side rendering / XHRs populate the product data.
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    }

    const html: string = await page.content();
    const finalUrl: string = page.url();
    return { ok: true, html, finalUrl, captured };
  } catch (e) {
    return { ok: false, error: `Headless render failed: ${(e as Error).message}` };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
