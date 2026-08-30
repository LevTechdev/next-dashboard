/**
 * Platform connector adapters for real shopping-platform APIs.
 *
 * Each adapter implements `testConnection` and `fetchProducts` against the
 * platform's real Open API (correct hosts, paths, and request signing).
 * Calls are only attempted when credentials are configured on the
 * PlatformConnection record; otherwise a clear "not configured" result is
 * returned so the UI can guide the user to enter credentials.
 *
 * Credential mapping per platform:
 * - tiktok-shop: apiKey=app_key, apiSecret=app_secret, accessToken, shopId=shop_cipher
 * - shopee:      apiKey=partner_id, apiSecret=partner_key, accessToken, shopId=shop_id
 * - tokopedia:   apiKey=client_id, apiSecret=client_secret, accessToken, shopId=fs_id
 * - facebook / instagram (Meta Commerce): accessToken, shopId=catalog_id
 */
import crypto from "crypto";

export interface ConnectionCreds {
  apiKey?: string | null;
  apiSecret?: string | null;
  accessToken?: string | null;
  shopId?: string | null;
  storeUrl?: string | null;
}

export interface ConnectorResult {
  ok: boolean;
  error?: string;
  data?: unknown;
}

export interface RemoteProduct {
  externalId: string;
  name: string;
  price: number;
  stock: number;
  sku?: string;
  url?: string;
}

export interface ProductsResult extends ConnectorResult {
  products?: RemoteProduct[];
}

interface Connector {
  testConnection(creds: ConnectionCreds): Promise<ConnectorResult>;
  fetchProducts(creds: ConnectionCreds): Promise<ProductsResult>;
}

const FETCH_TIMEOUT_MS = 15000;

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function missing(fields: string[]): ConnectorResult {
  return { ok: false, error: `Missing credentials: ${fields.join(", ")}` };
}

function requireCreds(creds: ConnectionCreds, fields: (keyof ConnectionCreds)[]): string[] {
  return fields.filter((f) => !creds[f]);
}

// ─── TikTok Shop (Open API, partner.tiktokshop.com) ─────────────

const TIKTOK_HOST = "https://open-api.tiktokglobalshop.com";

/** TikTok Shop request signature: HMAC-SHA256 over path + sorted params + body */
function tiktokSign(
  path: string,
  params: Record<string, string>,
  secret: string,
  body?: string,
): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  const base = `${secret}${path}${sorted}${body || ""}${secret}`;
  return crypto.createHmac("sha256", secret).update(base).digest("hex");
}

const tiktokShop: Connector = {
  async testConnection(creds) {
    const miss = requireCreds(creds, ["apiKey", "apiSecret", "accessToken", "shopId"]);
    if (miss.length) return missing(miss);
    try {
      const path = "/authorization/202309/shops";
      const params: Record<string, string> = {
        app_key: creds.apiKey!,
        timestamp: String(Math.floor(Date.now() / 1000)),
      };
      params.sign = tiktokSign(path, params, creds.apiSecret!);
      const qs = new URLSearchParams(params).toString();
      const res = await timedFetch(`${TIKTOK_HOST}${path}?${qs}`, {
        headers: { "x-tts-access-token": creds.accessToken!, "Content-Type": "application/json" },
      });
      const json = (await res.json()) as { code?: number; message?: string };
      if (res.ok && json.code === 0) return { ok: true, data: json };
      return { ok: false, error: json.message || `TikTok Shop API error (HTTP ${res.status})` };
    } catch (e) {
      return { ok: false, error: `TikTok Shop unreachable: ${(e as Error).message}` };
    }
  },
  async fetchProducts(creds) {
    const miss = requireCreds(creds, ["apiKey", "apiSecret", "accessToken", "shopId"]);
    if (miss.length) return missing(miss);
    try {
      const path = "/product/202309/products/search";
      const body = JSON.stringify({ page_size: 50 });
      const params: Record<string, string> = {
        app_key: creds.apiKey!,
        shop_cipher: creds.shopId!,
        timestamp: String(Math.floor(Date.now() / 1000)),
      };
      params.sign = tiktokSign(path, params, creds.apiSecret!, body);
      const qs = new URLSearchParams(params).toString();
      const res = await timedFetch(`${TIKTOK_HOST}${path}?${qs}`, {
        method: "POST",
        headers: { "x-tts-access-token": creds.accessToken!, "Content-Type": "application/json" },
        body,
      });
      const json = (await res.json()) as {
        code?: number;
        message?: string;
        data?: { products?: any[] };
      };
      if (!res.ok || json.code !== 0) {
        return { ok: false, error: json.message || `TikTok Shop API error (HTTP ${res.status})` };
      }
      const products: RemoteProduct[] = (json.data?.products || []).map((p: any) => ({
        externalId: String(p.id),
        name: p.title,
        price: parseFloat(p.skus?.[0]?.price?.tax_exclusive_price || "0"),
        stock: p.skus?.[0]?.inventory?.[0]?.quantity || 0,
        sku: p.skus?.[0]?.seller_sku,
        url: `https://shop.tiktok.com/view/product/${p.id}`,
      }));
      return { ok: true, products };
    } catch (e) {
      return { ok: false, error: `TikTok Shop unreachable: ${(e as Error).message}` };
    }
  },
};

// ─── Shopee (Open Platform v2, partner.shopeemobile.com) ────────

const SHOPEE_HOST = "https://partner.shopeemobile.com";

/** Shopee v2 signature: HMAC-SHA256(partner_id + path + timestamp + access_token + shop_id) */
function shopeeSign(
  partnerId: string,
  path: string,
  timestamp: number,
  partnerKey: string,
  accessToken = "",
  shopId = "",
): string {
  const base = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  return crypto.createHmac("sha256", partnerKey).update(base).digest("hex");
}

const shopee: Connector = {
  async testConnection(creds) {
    const miss = requireCreds(creds, ["apiKey", "apiSecret", "accessToken", "shopId"]);
    if (miss.length) return missing(miss);
    try {
      const path = "/api/v2/shop/get_shop_info";
      const ts = Math.floor(Date.now() / 1000);
      const sign = shopeeSign(
        creds.apiKey!,
        path,
        ts,
        creds.apiSecret!,
        creds.accessToken!,
        creds.shopId!,
      );
      const qs = new URLSearchParams({
        partner_id: creds.apiKey!,
        timestamp: String(ts),
        access_token: creds.accessToken!,
        shop_id: creds.shopId!,
        sign,
      }).toString();
      const res = await timedFetch(`${SHOPEE_HOST}${path}?${qs}`);
      const json = (await res.json()) as { error?: string; message?: string };
      if (res.ok && !json.error) return { ok: true, data: json };
      return {
        ok: false,
        error: json.message || json.error || `Shopee API error (HTTP ${res.status})`,
      };
    } catch (e) {
      return { ok: false, error: `Shopee unreachable: ${(e as Error).message}` };
    }
  },
  async fetchProducts(creds) {
    const miss = requireCreds(creds, ["apiKey", "apiSecret", "accessToken", "shopId"]);
    if (miss.length) return missing(miss);
    try {
      const path = "/api/v2/product/get_item_list";
      const ts = Math.floor(Date.now() / 1000);
      const sign = shopeeSign(
        creds.apiKey!,
        path,
        ts,
        creds.apiSecret!,
        creds.accessToken!,
        creds.shopId!,
      );
      const qs = new URLSearchParams({
        partner_id: creds.apiKey!,
        timestamp: String(ts),
        access_token: creds.accessToken!,
        shop_id: creds.shopId!,
        sign,
        offset: "0",
        page_size: "50",
        item_status: "NORMAL",
      }).toString();
      const res = await timedFetch(`${SHOPEE_HOST}${path}?${qs}`);
      const json = (await res.json()) as {
        error?: string;
        message?: string;
        response?: { item?: { item_id: number; item_name?: string }[] };
      };
      if (!res.ok || json.error) {
        return {
          ok: false,
          error: json.message || json.error || `Shopee API error (HTTP ${res.status})`,
        };
      }
      const products: RemoteProduct[] = (json.response?.item || []).map((it) => ({
        externalId: String(it.item_id),
        name: it.item_name || `Item ${it.item_id}`,
        price: 0, // Shopee requires a second get_item_base_info call for prices
        stock: 0,
        url: creds.storeUrl ? `${creds.storeUrl}/product/${creds.shopId}/${it.item_id}` : undefined,
      }));
      return { ok: true, products };
    } catch (e) {
      return { ok: false, error: `Shopee unreachable: ${(e as Error).message}` };
    }
  },
};

// ─── Tokopedia (Open API, fs.tokopedia.net) ──────────────────────

const TOKOPEDIA_HOST = "https://fs.tokopedia.net";

const tokopedia: Connector = {
  async testConnection(creds) {
    const miss = requireCreds(creds, ["accessToken", "shopId"]);
    if (miss.length) return missing(miss);
    try {
      const res = await timedFetch(`${TOKOPEDIA_HOST}/v1/shop/fs/${creds.shopId}/shop-info`, {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      const json = (await res.json()) as { header?: { error_code?: number; messages?: string } };
      if (res.ok) return { ok: true, data: json };
      return {
        ok: false,
        error: json.header?.messages || `Tokopedia API error (HTTP ${res.status})`,
      };
    } catch (e) {
      return { ok: false, error: `Tokopedia unreachable: ${(e as Error).message}` };
    }
  },
  async fetchProducts(creds) {
    const miss = requireCreds(creds, ["accessToken", "shopId"]);
    if (miss.length) return missing(miss);
    try {
      const res = await timedFetch(
        `${TOKOPEDIA_HOST}/inventory/v1/fs/${creds.shopId}/product/info?page=1&per_page=50`,
        { headers: { Authorization: `Bearer ${creds.accessToken}` } },
      );
      const json = (await res.json()) as {
        header?: { messages?: string };
        data?: any[];
      };
      if (!res.ok) {
        return {
          ok: false,
          error: json.header?.messages || `Tokopedia API error (HTTP ${res.status})`,
        };
      }
      const products: RemoteProduct[] = (json.data || []).map((p: any) => ({
        externalId: String(p.basic?.productID ?? p.product_id),
        name: p.basic?.name || p.name || "Unknown",
        price: p.price?.value || 0,
        stock: p.stock?.value || 0,
        sku: p.other?.sku,
        url: p.other?.url,
      }));
      return { ok: true, products };
    } catch (e) {
      return { ok: false, error: `Tokopedia unreachable: ${(e as Error).message}` };
    }
  },
};

// ─── Meta Commerce (Facebook / Instagram Shops, Graph API) ──────

const META_HOST = "https://graph.facebook.com/v19.0";

const metaCommerce: Connector = {
  async testConnection(creds) {
    const miss = requireCreds(creds, ["accessToken", "shopId"]);
    if (miss.length) return missing(miss);
    try {
      const res = await timedFetch(
        `${META_HOST}/${creds.shopId}?fields=id,name&access_token=${encodeURIComponent(creds.accessToken!)}`,
      );
      const json = (await res.json()) as { id?: string; error?: { message?: string } };
      if (res.ok && json.id) return { ok: true, data: json };
      return {
        ok: false,
        error: json.error?.message || `Meta Graph API error (HTTP ${res.status})`,
      };
    } catch (e) {
      return { ok: false, error: `Meta Graph API unreachable: ${(e as Error).message}` };
    }
  },
  async fetchProducts(creds) {
    const miss = requireCreds(creds, ["accessToken", "shopId"]);
    if (miss.length) return missing(miss);
    try {
      const res = await timedFetch(
        `${META_HOST}/${creds.shopId}/products?fields=id,name,price,inventory,retailer_id,url&limit=50&access_token=${encodeURIComponent(creds.accessToken!)}`,
      );
      const json = (await res.json()) as {
        data?: any[];
        error?: { message?: string };
      };
      if (!res.ok || json.error) {
        return {
          ok: false,
          error: json.error?.message || `Meta Graph API error (HTTP ${res.status})`,
        };
      }
      const products: RemoteProduct[] = (json.data || []).map((p: any) => ({
        externalId: String(p.id),
        name: p.name,
        // Meta returns price as a formatted string like "$12.99"
        price: parseFloat(String(p.price || "0").replace(/[^0-9.]/g, "")) || 0,
        stock: p.inventory || 0,
        sku: p.retailer_id,
        url: p.url,
      }));
      return { ok: true, products };
    } catch (e) {
      return { ok: false, error: `Meta Graph API unreachable: ${(e as Error).message}` };
    }
  },
};

// ─── Registry ────────────────────────────────────────────────────

const CONNECTORS: Record<string, Connector> = {
  "tiktok-shop": tiktokShop,
  shopee,
  tokopedia,
  facebook: metaCommerce,
  instagram: metaCommerce,
  lazada: shopee, // Lazada Open Platform uses an HMAC scheme close to Shopee's; placeholder mapping
};

export function getConnector(platformSlug: string): Connector | null {
  return CONNECTORS[platformSlug] || null;
}

/** Default platform catalog seeded on first use. */
export const DEFAULT_PLATFORMS = [
  {
    name: "TikTok Shop",
    slug: "tiktok-shop",
    baseUrl: "https://shop.tiktok.com",
    color: "#FE2C55",
    sortOrder: 1,
  },
  {
    name: "Shopee",
    slug: "shopee",
    baseUrl: "https://shopee.co.id",
    color: "#EE4D2D",
    sortOrder: 2,
  },
  {
    name: "Tokopedia",
    slug: "tokopedia",
    baseUrl: "https://www.tokopedia.com",
    color: "#03AC0E",
    sortOrder: 3,
  },
  {
    name: "Facebook",
    slug: "facebook",
    baseUrl: "https://www.facebook.com/marketplace",
    color: "#1877F2",
    sortOrder: 4,
  },
  {
    name: "Instagram",
    slug: "instagram",
    baseUrl: "https://www.instagram.com",
    color: "#E4405F",
    sortOrder: 5,
  },
  {
    name: "Lazada",
    slug: "lazada",
    baseUrl: "https://www.lazada.co.id",
    color: "#0F146D",
    sortOrder: 6,
  },
];
