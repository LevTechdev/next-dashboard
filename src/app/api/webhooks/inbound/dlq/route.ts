import { NextResponse } from "next/server";
import { getDlqEntries, retryDlqEntry, purgeDlqEntry, enqueueDlq } from "@/lib/webhook-dlq-store";
import { processDueRetries, scheduleRetry, isExhausted } from "@/lib/webhook-retry";
import { requireAuth } from "@/lib/api-guard";
import crypto from "crypto";
import { PLATFORM_SECRETS } from "@/lib/inbound-webhooks";

export const dynamic = "force-dynamic";

/** Sweep throttle — at most one automatic retry sweep per minute per instance. */
let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Re-dispatch a stored DLQ entry to the internal receiver exactly as it
 * arrived (original headers minus hop-by-hop ones, original payload). Valid
 * signatures re-ingest successfully; invalid ones fail again by design —
 * those are permanent failures a human must resolve.
 */
async function redispatch(
  entry: { platform: string; headers: Record<string, string>; payload: unknown },
  origin: string,
): Promise<boolean> {
  const HOP_BY_HOP = new Set(["host", "connection", "content-length", "cookie", "accept-encoding"]);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  for (const [k, v] of Object.entries(entry.headers || {})) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) headers[k] = v;
  }
  try {
    const res = await fetch(`${origin}/api/webhooks/inbound/${entry.platform}`, {
      method: "POST",
      headers,
      body: JSON.stringify(entry.payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { response } = await requireAuth(req);
  if (response) return response;

  // Opportunistic delivery-health sweep: due RETRYING entries get
  // re-dispatched before the dashboard reads the queue (throttled).
  const now = Date.now();
  if (now - lastSweepAt > SWEEP_INTERVAL_MS) {
    lastSweepAt = now;
    try {
      const origin = new URL(req.url).origin;
      await processDueRetries((entry) => redispatch(entry, origin));
    } catch {
      // Sweep is best-effort — the read must never fail because of it.
    }
  }

  const entries = getDlqEntries();
  const summary = {
    totalFailed: entries.filter((e) => e.status === "FAILED").length,
    totalRetrying: entries.filter((e) => e.status === "RETRYING").length,
    totalResolved: entries.filter((e) => e.status === "RESOLVED").length,
    totalExhausted: entries.filter((e) => isExhausted(e)).length,
    totalCount: entries.length,
  };

  return NextResponse.json({
    ok: true,
    summary,
    entries,
    platforms: ["shopify", "tiktok", "shopee", "woocommerce"],
  });
}

export async function POST(req: Request) {
  const { response } = await requireAuth(req);
  if (response) return response;

  try {
    const body = await req.json();
    const { action, id, platform = "shopify", simulateFailure = false } = body;

    if (action === "replay") {
      // One-click replay from the Integrations DLQ tab: re-dispatch now and
      // resolve on success; on failure leave the entry in the RETRYING
      // rotation with the next backoff (or terminal FAILED when exhausted).
      if (!id) return NextResponse.json({ error: "Missing DLQ entry ID" }, { status: 400 });
      const scheduled = scheduleRetry(id);
      if (!scheduled.success || !scheduled.entry) {
        return NextResponse.json({ ok: false, message: scheduled.message }, { status: 404 });
      }
      const origin = new URL(req.url).origin;
      const ok = await redispatch(scheduled.entry, origin);
      if (ok) {
        retryDlqEntry(id);
      }
      return NextResponse.json({
        ok,
        message: ok
          ? "Replayed successfully — entry resolved"
          : "Replay failed again — left in the retry rotation",
        entry: getDlqEntries().find((e) => e.id === id),
      });
    }

    if (action === "discard") {
      // Alias of purge with clearer semantics for the UI (remove permanently).
      if (!id) return NextResponse.json({ error: "Missing DLQ entry ID" }, { status: 400 });
      const success = purgeDlqEntry(id);
      return NextResponse.json({
        ok: success,
        message: success ? "Delivery discarded" : "Entry not found",
      });
    }

    if (action === "sweep") {
      // Manual trigger for the automatic retry sweep (used by tests + the
      // "Process retries now" button).
      const origin = new URL(req.url).origin;
      const result = await processDueRetries((entry) => redispatch(entry, origin));
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "retry") {
      if (!id) return NextResponse.json({ error: "Missing DLQ entry ID" }, { status: 400 });
      const result = retryDlqEntry(id);
      return NextResponse.json({
        ok: result.success,
        message: result.message,
        entry: result.entry,
      });
    }

    if (action === "purge") {
      if (!id) return NextResponse.json({ error: "Missing DLQ entry ID" }, { status: 400 });
      const success = purgeDlqEntry(id);
      return NextResponse.json({
        ok: success,
        message: success ? "DLQ entry removed" : "Entry not found",
      });
    }

    if (action === "simulate") {
      const plat = platform.toLowerCase();
      const mockPayloads: Record<string, any> = {
        shopify: {
          id: String(Date.now()),
          name: `#SHPF-${Math.floor(1000 + Math.random() * 9000)}`,
          customer: { first_name: "Sarah", last_name: "Jenkins", email: "sarah.j@gmail.com" },
          line_items: [
            { title: "Linen Summer Blazer", sku: "BLZ-LIN-01", quantity: 1, price: 450000 },
          ],
          total_price: 450000,
          currency: "IDR",
          financial_status: "paid",
        },
        tiktok: {
          order_id: String(Date.now()),
          buyer_email: "tiktok.buyer@creator.co",
          recipient_address: { name: "Rian Pratama", city: "Jakarta Selatan" },
          item_list: [
            {
              product_name: "Oversized Vintage Hoodie",
              sku_id: "TTS-HOOD-01",
              quantity: 1,
              sale_price: 280000,
            },
          ],
          payment_info: { total_amount: 280000, currency: "IDR" },
        },
        shopee: {
          order_sn: String(Date.now()),
          buyer_username: "shopee_superbuyer",
          item_list: [
            {
              item_name: "Smart Ceramic Mug",
              item_sku: "SHP-MUG-01",
              model_quantity_purchased: 2,
              model_discounted_price: 95000,
            },
          ],
          total_amount: 190000,
          currency: "IDR",
        },
        woocommerce: {
          id: String(Date.now()),
          billing: { first_name: "Andi", last_name: "Wijaya", email: "andi@domain.id" },
          line_items: [
            {
              name: "Handmade Leather Wallet",
              sku: "WC-WLT-01",
              quantity: 1,
              price: 320000,
              total: 320000,
            },
          ],
          total: 320000,
          currency: "IDR",
          status: "processing",
        },
      };

      const payload = mockPayloads[plat] || mockPayloads.shopify;
      const rawBody = JSON.stringify(payload);

      if (simulateFailure) {
        // Enqueue directly to DLQ
        const dlq = enqueueDlq({
          platform: plat as any,
          event: "order.inbound",
          headers: { "x-signature-status": "tampered" },
          payload,
          errorMessage: `Simulated cryptographic verification failure for ${plat.toUpperCase()} test dispatch`,
        });

        return NextResponse.json({
          ok: false,
          simulated: true,
          status: "DLQ_ENQUEUED",
          dlqId: dlq.id,
          message: `Simulated failure enqueued in DLQ (${dlq.id})`,
        });
      }

      // Compute valid signature
      const secret = PLATFORM_SECRETS[plat] || "default_secret";
      let signatureHeaderName = "x-shopify-hmac-sha256";
      let signatureValue = crypto
        .createHmac("sha256", secret)
        .update(rawBody, "utf8")
        .digest("base64");

      if (plat === "tiktok") {
        signatureHeaderName = "x-tiktok-signature";
        signatureValue = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
      } else if (plat === "shopee") {
        signatureHeaderName = "x-shopee-signature";
        signatureValue = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
      } else if (plat === "woocommerce") {
        signatureHeaderName = "x-wc-webhook-signature";
        signatureValue = crypto
          .createHmac("sha256", secret)
          .update(rawBody, "utf8")
          .digest("base64");
      }

      // Dispatch to internal receiver
      const url = new URL(req.url);
      const receiverUrl = `${url.origin}/api/webhooks/inbound/${plat}`;
      const internalRes = await fetch(receiverUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [signatureHeaderName]: signatureValue,
        },
        body: rawBody,
      });

      const json = await internalRes.json();
      return NextResponse.json({
        ok: internalRes.ok,
        simulated: true,
        receiverResponse: json,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal DLQ error" }, { status: 500 });
  }
}
