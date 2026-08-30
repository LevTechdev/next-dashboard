/**
 * Product-link importer.
 *
 * Turns a real product URL that a user copies from Shopee / TikTok Shop /
 * Instagram / Lazada / Tokopedia into normalized product data (name, price,
 * image, description) WITHOUT requiring official platform API credentials.
 *
 * Strategy per platform:
 *  - Shopee:   parse shopid/itemid from the URL, then call the public item
 *              endpoint (/api/v4/item/get) which returns full JSON product data.
 *  - Lazada:   parse itemId from the URL, then read Open Graph + JSON-LD tags.
 *  - Tokopedia / TikTok Shop / Instagram / others:
 *              read Open Graph (og:title/og:image/product:price) + JSON-LD
 *              (schema.org Product) from the server-rendered HTML — the same
 *              metadata social apps use for link previews.
 *
 * These public sources can be rate-limited or bot-blocked; every fetch fails
 * gracefully so the caller can let the user fill missing fields manually.
 */

export interface FetchedProduct {
  platformSlug: string;
  externalId?: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  images: string[];
  description?: string;
  url: string;
  stock?: number;
  source: string; // data format: "shopee-api" | "opengraph" | "json-ld"
  fetchTier: string; // how fetched: "shopee-api" | "direct" | "facebook-crawler" | "twitter-crawler" | "headless"
  partial: boolean; // true when price/name could not be fully resolved
}

export interface FetchResult {
  ok: boolean;
  product?: FetchedProduct;
  platformSlug?: string;
  error?: string;
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
};

/**
 * User-Agents tried in order for static fetching (Option A). Many marketplaces
 * that block generic requests still serve Open Graph tags to the Facebook /
 * Twitter link-preview crawlers, so we retry as those before escalating.
 */
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Twitterbot/1.0",
];

const FETCH_TIMEOUT_MS = 15000;

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { redirect: "follow", ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Detect the platform slug from a product URL's hostname. */
export function detectPlatform(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host.includes("shopee")) return "shopee";
  if (host.includes("tokopedia")) return "tokopedia";
  if (host.includes("lazada")) return "lazada";
  if (host.includes("tiktok")) return "tiktok-shop";
  if (host.includes("instagram")) return "instagram";
  if (host.includes("facebook") || host.includes("fb.")) return "facebook";
  return null;
}

// ─── HTML metadata extraction (no DOM dependency) ────────────────

/** Read a <meta property|name="key" content="value"> value (any attr order). */
function readMeta(html: string, key: string): string | undefined {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escapeRe(key)}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escapeRe(key)}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities(m[1].trim());
  }
  return undefined;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ");
}

/** Find the first schema.org Product object inside JSON-LD script blocks. */
function readJsonLdProduct(html: string): Record<string, unknown> | null {
  const blocks = [
    ...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b[1].trim());
      const candidates = Array.isArray(parsed) ? parsed : [parsed, ...(parsed["@graph"] || [])];
      for (const node of candidates) {
        if (!node || typeof node !== "object") continue;
        const type = node["@type"];
        const isProduct = Array.isArray(type) ? type.includes("Product") : type === "Product";
        if (isProduct) return node as Record<string, unknown>;
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return null;
}

function parsePriceString(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.,]/g, "").replace(/,(?=\d{3}\b)/g, "");
    const normalized = cleaned.replace(/,/g, ".");
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

/** Resolve a possibly relative / protocol-relative image URL against a base. */
function toAbsoluteUrl(src: string | undefined, base: string): string | undefined {
  if (!src) return undefined;
  const trimmed = src.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return undefined;
  }
}

/** Extract product data from server-rendered HTML using OG tags + JSON-LD. */
function extractFromHtml(html: string, url: string, platformSlug: string): FetchedProduct {
  const ld = readJsonLdProduct(html);
  const offers = (ld?.offers as Record<string, unknown>) || {};
  const offer = Array.isArray(offers) ? (offers[0] as Record<string, unknown>) : offers;

  const name =
    (ld?.name as string) || readMeta(html, "og:title") || readMeta(html, "twitter:title") || "";

  const priceMeta =
    readMeta(html, "product:price:amount") ||
    readMeta(html, "og:price:amount") ||
    readMeta(html, "twitter:data1");
  const price = parsePriceString(offer?.price ?? priceMeta ?? 0);

  const currency =
    (offer?.priceCurrency as string) ||
    readMeta(html, "product:price:currency") ||
    readMeta(html, "og:price:currency") ||
    "IDR";

  const image =
    (typeof ld?.image === "string" ? (ld.image as string) : undefined) ||
    (Array.isArray(ld?.image) ? (ld!.image as string[])[0] : undefined) ||
    readMeta(html, "og:image:secure_url") ||
    readMeta(html, "og:image") ||
    readMeta(html, "twitter:image");
  // Resolve relative / protocol-relative image URLs against the page URL so
  // the browser gets a loadable absolute reference.
  const absImage = toAbsoluteUrl(image, url);

  const description =
    (ld?.description as string) ||
    readMeta(html, "og:description") ||
    readMeta(html, "description");

  return {
    platformSlug,
    name: name.slice(0, 200),
    price,
    currency,
    image: absImage,
    images: absImage ? [absImage] : [],
    description: description?.slice(0, 500),
    url,
    source: ld ? "json-ld" : "opengraph",
    fetchTier: "direct",
    partial: !name || price <= 0,
  };
}

/** Fetch-tier labels aligned with the USER_AGENTS order. */
const UA_TIERS = ["direct", "facebook-crawler", "twitter-crawler"];

/**
 * Static HTML fetch tried across several User-Agents (Option A), including the
 * Facebook/Twitter link-preview crawlers which many sites serve OG tags to.
 */
async function fetchHtmlStatic(url: string, platformSlug: string): Promise<FetchResult> {
  let lastError = "Could not read product details";
  for (let i = 0; i < USER_AGENTS.length; i++) {
    try {
      const res = await timedFetch(url, {
        headers: { ...BROWSER_HEADERS, "User-Agent": USER_AGENTS[i] },
      });
      if (!res.ok) {
        lastError = `Page returned HTTP ${res.status}`;
        continue;
      }
      const html = await res.text();
      const product = extractFromHtml(html, res.url || url, platformSlug);
      if (product.name) {
        product.fetchTier = UA_TIERS[i] || "direct";
        return { ok: true, product };
      }
      lastError = "No product metadata in page";
    } catch (e) {
      lastError = `Fetch failed: ${(e as Error).message}`;
    }
  }
  return { ok: false, platformSlug, error: lastError };
}

/**
 * Headless escalation (Option B): render the page with Playwright so client-side
 * JS runs, capture any product-API JSON (e.g. Shopee's item endpoint), then
 * extract from the fully-rendered HTML.
 */
async function fetchHtmlHeadless(url: string, platformSlug: string): Promise<FetchResult> {
  const { renderPage } = await import("./headless-fetch");
  const r = await renderPage(url, {
    captureUrlIncludes: ["/api/v4/item/get", "/api/v4/pdp/get_pc"],
  });
  if (!r.ok || !r.html) {
    return { ok: false, platformSlug, error: r.error || "Headless render failed" };
  }
  // Shopee: prefer intercepted product-API JSON when available.
  if (platformSlug === "shopee" && r.captured) {
    for (const body of Object.values(r.captured)) {
      const item = extractShopeeItem(body as Record<string, unknown>);
      if (item) {
        const product = mapShopeeItem(item, undefined, r.finalUrl || url);
        product.fetchTier = "headless";
        return { ok: true, product };
      }
    }
  }
  const product = extractFromHtml(r.html, r.finalUrl || url, platformSlug);
  if (product.name) {
    product.fetchTier = "headless";
    return { ok: true, product };
  }
  return {
    ok: false,
    platformSlug,
    error: "Could not read product details (page may require login or blocks bots)",
  };
}

async function fetchHtmlProduct(
  url: string,
  platformSlug: string,
  allowHeadless = true,
): Promise<FetchResult> {
  const staticResult = await fetchHtmlStatic(url, platformSlug);
  if (staticResult.ok || !allowHeadless) return staticResult;
  // Static extraction failed (bot-blocked or JS-rendered) -> escalate to headless.
  return fetchHtmlHeadless(url, platformSlug);
}

// ─── Shopee: public item API ─────────────────────────────────────

/** Parse Shopee shopid + itemid from any Shopee product URL form. */
export function parseShopeeIds(url: string): { shopId: string; itemId: string } | null {
  // form: .../product/{shopid}/{itemid}
  const p = url.match(/product\/(\d+)\/(\d+)/);
  if (p) return { shopId: p[1], itemId: p[2] };
  // form: ...-i.{shopid}.{itemid}
  const i = url.match(/-i\.(\d+)\.(\d+)/) || url.match(/i\.(\d+)\.(\d+)/);
  if (i) return { shopId: i[1], itemId: i[2] };
  return null;
}

/** Pull the item object out of Shopee's various response shapes. */
function extractShopeeItem(
  json: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!json || typeof json !== "object" || json.error) return null;
  const data = json.data as Record<string, unknown> | undefined;
  if (!data) return null;
  // /api/v4/item/get -> data is the item; /api/v4/pdp/get_pc -> data.item
  const item = (data.item as Record<string, unknown>) || data;
  if (item && (item.name || item.itemid)) return item;
  return null;
}

/** Map a Shopee item object to our normalized product shape. */
function mapShopeeItem(
  item: Record<string, unknown>,
  itemIdFallback: string | undefined,
  url: string,
): FetchedProduct {
  const imageHash = item.image as string | undefined;
  const imageHashes = (item.images as string[]) || (imageHash ? [imageHash] : []);
  const toImg = (h: string) => `https://down-id.img.susercontent.com/file/${h}`;
  // Shopee stores prices multiplied by 100000.
  const rawPrice = (item.price as number) ?? (item.price_min as number) ?? 0;
  return {
    platformSlug: "shopee",
    externalId: String(item.itemid ?? itemIdFallback ?? ""),
    name: String(item.name || "").slice(0, 200),
    price: rawPrice ? rawPrice / 100000 : 0,
    currency: "IDR",
    image: imageHash ? toImg(imageHash) : undefined,
    images: imageHashes.map(toImg),
    description: (item.description as string)?.slice(0, 500),
    url,
    stock: (item.stock as number) ?? undefined,
    source: "shopee-api",
    fetchTier: "shopee-api",
    partial: !item.name || !rawPrice,
  };
}

async function fetchShopeeProduct(url: string, allowHeadless = true): Promise<FetchResult> {
  let origin = "https://shopee.co.id";
  try {
    origin = new URL(url).origin;
  } catch {
    /* keep default */
  }

  // Short links (s.shopee / redirect) — resolve to the canonical URL first.
  let resolvedUrl = url;
  let ids = parseShopeeIds(url);
  if (!ids) {
    try {
      const head = await timedFetch(url, { headers: BROWSER_HEADERS });
      resolvedUrl = head.url || url;
      ids = parseShopeeIds(resolvedUrl);
    } catch {
      /* fall through */
    }
  }

  // Fast path: hit the public item API directly.
  if (ids) {
    try {
      const apiUrl = `${origin}/api/v4/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`;
      const res = await timedFetch(apiUrl, {
        headers: {
          ...BROWSER_HEADERS,
          Accept: "application/json",
          Referer: resolvedUrl,
          "x-api-source": "pc",
        },
      });
      if (res.ok) {
        const json = (await res.json()) as Record<string, unknown>;
        const item = extractShopeeItem(json);
        if (item) return { ok: true, product: mapShopeeItem(item, ids.itemId, resolvedUrl) };
      }
    } catch {
      /* escalate below */
    }
  }

  // No headless allowed: best-effort static HTML (OG tags) as a last resort.
  if (!allowHeadless) {
    return fetchHtmlStatic(resolvedUrl, "shopee");
  }
  // Escalate to headless: renders the PDP and captures the item API in-browser,
  // which bypasses datacenter-IP blocking on the plain API request.
  return fetchHtmlHeadless(resolvedUrl, "shopee");
}

// ─── Public entry point ──────────────────────────────────────────

export async function fetchProductFromUrl(
  rawUrl: string,
  opts: { allowHeadless?: boolean } = {},
): Promise<FetchResult> {
  const allowHeadless = opts.allowHeadless !== false;
  const url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: "Please provide a full http(s) product URL" };
  }
  const platformSlug = detectPlatform(url);
  if (!platformSlug) {
    return {
      ok: false,
      error: "Unsupported link. Use a Shopee, TikTok Shop, Instagram, Lazada, or Tokopedia URL.",
    };
  }

  if (platformSlug === "shopee") {
    return fetchShopeeProduct(url, allowHeadless);
  }
  // Lazada / Tokopedia / TikTok Shop / Instagram / Facebook -> HTML metadata
  return fetchHtmlProduct(url, platformSlug, allowHeadless);
}
