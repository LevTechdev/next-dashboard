import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { loadQrisLedger } from "@/lib/qris-ledger-store";
import { isSameOrigin } from "@/lib/outbound-url";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { session, response } = await requirePermission("update", "billing", req);
    if (response) return response;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = await effectiveTenantId(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
    }

    // Signing key is server-side only; a caller can never choose it again.
    const webhookSecret = process.env.WEBHOOK_SIMULATE_SECRET?.trim();
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Webhook simulator is not configured (WEBHOOK_SIMULATE_SECRET)" },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      eventType = "qris.payment_success",
      transactionId,
      amount = 250000,
      bank = "BCA Mobile",
      customerName = "Walk-in Customer",
      targetUrl,
    } = body;

    // Optional external dispatch is same-origin only: this endpoint must never
    // become a proxy for requests to arbitrary internal or external hosts.
    if (targetUrl && !isSameOrigin(String(targetUrl), req.url)) {
      return NextResponse.json(
        { error: "targetUrl must be same-origin with the dashboard" },
        { status: 400 },
      );
    }

    const ledger = await loadQrisLedger(tenantId);
    let tx: any = null;
    const state = ledger.getState();

    // 1. Resolve or Create Target Transaction
    if (transactionId) {
      tx = state.transactions.find((t) => t.id === transactionId);
    }

    if (!tx) {
      // Auto-create transaction for the simulation
      tx = ledger.createTransaction(Number(amount) || 150000, customerName);
    }

    // 2. Apply Event State Transitions to Ledger
    if (eventType === "qris.payment_success") {
      tx = ledger.confirmPayment(tx.id, bank);
    } else if (eventType === "payment.dispute_created") {
      tx = ledger.disputeTransaction(tx.id, "Customer claim: Unauthorized payment chargeback");
    } else if (eventType === "payment.failed") {
      tx = ledger.expireTransaction(tx.id);
    } else if (eventType === "qris.settlement_completed") {
      // If pending, first confirm payment then report settlement
      if (tx.status === "PENDING") {
        tx = ledger.confirmPayment(tx.id, bank);
      }
    }

    // 3. Build Standardized Webhook Event Payload
    const eventId = `evt_sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const timestamp = Math.floor(Date.now() / 1000);

    const payloadObject = {
      id: eventId,
      event: eventType,
      created: timestamp,
      apiVersion: "2026-09-08",
      data: {
        object: "payment_notification",
        id: tx.id,
        invoiceNumber: tx.invoiceNumber,
        amount: tx.amount,
        currency: "IDR",
        status: tx.status,
        paymentMethod: "qris",
        sourceBank: tx.sourceBank || bank,
        customerName: tx.customerName,
        rrn: tx.rrn,
        paidAt: tx.paidAt || new Date().toISOString(),
        settlementStatus: eventType === "qris.settlement_completed" ? "SETTLED" : "PENDING_BATCH",
      },
    };

    const payloadString = JSON.stringify(payloadObject, null, 2);

    // 4. Compute HMAC-SHA256 Cryptographic Signature
    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(`t=${timestamp}.${payloadString}`)
      .digest("hex");

    const signedHeaders = {
      "Content-Type": "application/json",
      "X-Webhook-Id": eventId,
      "X-Webhook-Event": eventType,
      "X-Webhook-Timestamp": timestamp.toString(),
      "X-Webhook-Signature": `t=${timestamp},v1=${signature}`,
      "User-Agent": "NextDashboard-PaymentGateway/2.0",
    };

    // 5. Optional Same-Origin Dispatch
    let deliveryStatus = "LOCAL_DISPATCH";
    let statusCode = 200;
    let latencyMs = 12;
    let responseBody = "Acknowledged by internal ledger and event bus";

    if (targetUrl) {
      const startTime = Date.now();
      try {
        const res = await fetch(new URL(String(targetUrl), req.url), {
          method: "POST",
          headers: signedHeaders,
          body: payloadString,
          signal: AbortSignal.timeout(6000),
        });
        latencyMs = Date.now() - startTime;
        statusCode = res.status;
        responseBody = await res.text().catch(() => "");
        deliveryStatus = statusCode >= 200 && statusCode < 300 ? "DELIVERED" : "FAILED";
      } catch (err: any) {
        latencyMs = Date.now() - startTime;
        statusCode = 502;
        deliveryStatus = "NETWORK_ERROR";
        responseBody = err.message || "Failed to connect to target URL";
      }
    }

    return NextResponse.json({
      success: true,
      event: eventType,
      transaction: tx,
      payload: payloadObject,
      signature: `t=${timestamp},v1=${signature}`,
      headers: signedHeaders,
      delivery: {
        status: deliveryStatus,
        statusCode,
        latencyMs,
        responseBody: responseBody.slice(0, 500),
      },
      ledger: ledger.getState(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to simulate payment webhook" },
      { status: 500 },
    );
  }
}
