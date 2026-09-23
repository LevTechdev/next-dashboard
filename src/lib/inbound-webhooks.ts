import crypto from "crypto";

export interface NormalizedInboundOrder {
  orderNumber: string;
  externalId: string;
  platform: "shopify" | "tiktok" | "shopee" | "woocommerce";
  customerName: string;
  customerEmail: string;
  customerCity?: string;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  totalAmount: number;
  grandTotal: number;
  currency: string;
  paymentStatus: "PAID" | "PENDING" | "FAILED";
  orderStatus: "COMPLETED" | "PROCESSING" | "PENDING";
  rawPayload: any;
}

export const PLATFORM_SECRETS: Record<string, string> = {
  shopify: process.env.SHOPIFY_WEBHOOK_SECRET || "shpss_test_secret_key_84920412",
  tiktok: process.env.TIKTOK_WEBHOOK_SECRET || "tt_test_secret_key_91823749",
  shopee: process.env.SHOPEE_WEBHOOK_SECRET || "shp_test_secret_key_51029481",
  woocommerce: process.env.WOOCOMMERCE_WEBHOOK_SECRET || "wc_test_secret_key_77192834",
};

/**
 * Verify Shopify HMAC-SHA256 signature (Base64 encoded).
 * Header: X-Shopify-Hmac-SHA256
 */
export function verifyShopifySignature(
  rawBody: string,
  signature: string | null,
  secret = PLATFORM_SECRETS.shopify,
): boolean {
  if (!signature) return false;
  try {
    const hash = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Verify TikTok Shop signature (Hex encoded).
 * Header: X-TikTok-Signature or X-TTS-Signature
 */
export function verifyTikTokSignature(
  rawBody: string,
  signature: string | null,
  secret = PLATFORM_SECRETS.tiktok,
  timestamp?: string | null,
): boolean {
  if (!signature) return false;
  try {
    const payloadToSign = timestamp ? `${secret}${rawBody}${timestamp}` : `${secret}${rawBody}`;
    const hash = crypto.createHmac("sha256", secret).update(payloadToSign, "utf8").digest("hex");
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Verify Shopee signature (Hex encoded).
 * Header: X-Shopee-Signature
 */
export function verifyShopeeSignature(
  rawBody: string,
  signature: string | null,
  secret = PLATFORM_SECRETS.shopee,
  urlPath?: string | null,
): boolean {
  if (!signature) return false;
  try {
    const payloadToSign = urlPath ? `${urlPath}|${rawBody}` : rawBody;
    const hash = crypto.createHmac("sha256", secret).update(payloadToSign, "utf8").digest("hex");
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Verify WooCommerce webhook signature (Base64 encoded).
 * Header: X-WC-Webhook-Signature
 */
export function verifyWooCommerceSignature(
  rawBody: string,
  signature: string | null,
  secret = PLATFORM_SECRETS.woocommerce,
): boolean {
  if (!signature) return false;
  try {
    const hash = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Verify signature based on platform name.
 */
export function verifyInboundSignature(
  platform: string,
  rawBody: string,
  headers: Headers | Record<string, string>,
): boolean {
  const getHeader = (name: string): string | null => {
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name);
    }
    const lower = name.toLowerCase();
    const map = headers as Record<string, string>;
    for (const key of Object.keys(map)) {
      if (key.toLowerCase() === lower) return map[key];
    }
    return null;
  };

  switch (platform.toLowerCase()) {
    case "shopify":
      return verifyShopifySignature(rawBody, getHeader("x-shopify-hmac-sha256"));
    case "tiktok":
      return verifyTikTokSignature(
        rawBody,
        getHeader("x-tiktok-signature") || getHeader("x-tts-signature"),
        PLATFORM_SECRETS.tiktok,
        getHeader("x-tiktok-timestamp"),
      );
    case "shopee":
      return verifyShopeeSignature(rawBody, getHeader("x-shopee-signature"));
    case "woocommerce":
      return verifyWooCommerceSignature(rawBody, getHeader("x-wc-webhook-signature"));
    default:
      return false;
  }
}

/**
 * Normalize vendor-specific webhook payloads into a unified format.
 */
export function normalizeInboundOrder(platform: string, payload: any): NormalizedInboundOrder {
  const plat = platform.toLowerCase() as "shopify" | "tiktok" | "shopee" | "woocommerce";

  if (plat === "shopify") {
    const id = String(payload.id || Date.now());
    const orderNumber = payload.name || `SHPF-${id.slice(-6)}`;
    const items = (payload.line_items || []).map((li: any) => ({
      name: li.title || li.name || "Shopify Product",
      sku: li.sku || `SKU-${li.id || "GEN"}`,
      quantity: Number(li.quantity) || 1,
      price: Number(li.price) || 0,
      total: (Number(li.quantity) || 1) * (Number(li.price) || 0),
    }));
    return {
      orderNumber,
      externalId: id,
      platform: "shopify",
      customerName: payload.customer?.first_name
        ? `${payload.customer.first_name} ${payload.customer.last_name || ""}`.trim()
        : "Shopify Buyer",
      customerEmail: payload.customer?.email || payload.email || "buyer@shopify.com",
      customerCity: payload.shipping_address?.city || payload.billing_address?.city || "Jakarta",
      items: items.length
        ? items
        : [{ name: "Shopify Item", sku: "SHPF-01", quantity: 1, price: 150000, total: 150000 }],
      totalAmount: Number(payload.total_price) || 150000,
      grandTotal: Number(payload.total_price) || 150000,
      currency: payload.currency || "IDR",
      paymentStatus: payload.financial_status === "paid" ? "PAID" : "PENDING",
      orderStatus: "PROCESSING",
      rawPayload: payload,
    };
  }

  if (plat === "tiktok") {
    const id = String(payload.order_id || Date.now());
    const orderNumber = `TTS-${id.slice(-6)}`;
    const items = (payload.item_list || []).map((it: any) => ({
      name: it.product_name || "TikTok Shop Item",
      sku: it.sku_id || `TTS-${it.id || "GEN"}`,
      quantity: Number(it.quantity) || 1,
      sale_price: Number(it.sale_price) || 0,
      total: (Number(it.quantity) || 1) * (Number(it.sale_price) || 0),
    }));
    return {
      orderNumber,
      externalId: id,
      platform: "tiktok",
      customerName: payload.recipient_address?.name || "TikTok Creator Shopper",
      customerEmail: payload.buyer_email || `tiktok.buyer.${id.slice(-4)}@gmail.com`,
      customerCity: payload.recipient_address?.city || "Surabaya",
      items: items.length
        ? items
        : [
            {
              name: "TikTok Viral Top",
              sku: "TTS-TOP-01",
              quantity: 2,
              price: 95000,
              total: 190000,
            },
          ],
      totalAmount: Number(payload.payment_info?.total_amount) || 190000,
      grandTotal: Number(payload.payment_info?.total_amount) || 190000,
      currency: payload.payment_info?.currency || "IDR",
      paymentStatus: "PAID",
      orderStatus: "PROCESSING",
      rawPayload: payload,
    };
  }

  if (plat === "shopee") {
    const id = String(payload.order_sn || Date.now());
    const orderNumber = `SHP-${id.slice(-6)}`;
    const items = (payload.item_list || []).map((it: any) => ({
      name: it.item_name || "Shopee Item",
      sku: it.item_sku || `SHP-${it.item_id || "GEN"}`,
      quantity: Number(it.model_quantity_purchased) || 1,
      price: Number(it.model_discounted_price) || 0,
      total: (Number(it.model_quantity_purchased) || 1) * (Number(it.model_discounted_price) || 0),
    }));
    return {
      orderNumber,
      externalId: id,
      platform: "shopee",
      customerName: payload.buyer_username || "Shopee Verified Buyer",
      customerEmail: `shopee.${id.slice(-4)}@user.shopee.co.id`,
      customerCity: payload.recipient_address?.city || "Bandung",
      items: items.length
        ? items
        : [
            {
              name: "Shopee Deal Product",
              sku: "SHP-PROD-01",
              quantity: 1,
              price: 125000,
              total: 125000,
            },
          ],
      totalAmount: Number(payload.total_amount) || 125000,
      grandTotal: Number(payload.total_amount) || 125000,
      currency: payload.currency || "IDR",
      paymentStatus: "PAID",
      orderStatus: "PROCESSING",
      rawPayload: payload,
    };
  }

  // WooCommerce default
  const id = String(payload.id || Date.now());
  const orderNumber = `WC-${id}`;
  const items = (payload.line_items || []).map((li: any) => ({
    name: li.name || "WooCommerce Item",
    sku: li.sku || `WC-${li.id || "GEN"}`,
    quantity: Number(li.quantity) || 1,
    price: Number(li.price) || 0,
    total: Number(li.total) || 0,
  }));
  return {
    orderNumber,
    externalId: id,
    platform: "woocommerce",
    customerName: payload.billing?.first_name
      ? `${payload.billing.first_name} ${payload.billing.last_name || ""}`.trim()
      : "WooCommerce Customer",
    customerEmail: payload.billing?.email || "customer@woocommerce.store",
    customerCity: payload.shipping?.city || payload.billing?.city || "Jakarta",
    items: items.length
      ? items
      : [
          {
            name: "WooCommerce Apparel",
            sku: "WC-APP-01",
            quantity: 1,
            price: 210000,
            total: 210000,
          },
        ],
    totalAmount: Number(payload.total) || 210000,
    grandTotal: Number(payload.total) || 210000,
    currency: payload.currency || "IDR",
    paymentStatus:
      payload.status === "completed" || payload.status === "processing" ? "PAID" : "PENDING",
    orderStatus: "PROCESSING",
    rawPayload: payload,
  };
}
