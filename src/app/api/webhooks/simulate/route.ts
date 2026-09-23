import { NextResponse } from "next/server";
import { qrisLedger } from "@/lib/qris-engine";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      eventType = "qris.payment_success",
      transactionId,
      amount = 250000,
      bank = "BCA Mobile",
      customerName = "Walk-in Customer",
      targetUrl,
      webhookSecret = "whsec_simulated_key_9920194821",
    } = body;

    let tx: any = null;
    const ledger = qrisLedger.getState();

    // 1. Resolve or Create Target Transaction
    if (transactionId) {
      tx = ledger.transactions.find((t) => t.id === transactionId);
    }

    if (!tx) {
      // Auto-create transaction for the simulation
      tx = qrisLedger.createTransaction(Number(amount) || 150000, customerName);
    }

    // 2. Apply Event State Transitions to Ledger
    if (eventType === "qris.payment_success") {
      tx = qrisLedger.confirmPayment(tx.id, bank);
    } else if (eventType === "payment.dispute_created") {
      tx = qrisLedger.disputeTransaction(tx.id, "Customer claim: Unauthorized payment chargeback");
    } else if (eventType === "payment.failed") {
      tx = qrisLedger.expireTransaction(tx.id);
    } else if (eventType === "qris.settlement_completed") {
      // If pending, first confirm payment then report settlement
      if (tx.status === "PENDING") {
        tx = qrisLedger.confirmPayment(tx.id, bank);
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

    // 5. Optional External Dispatch
    let deliveryStatus = "LOCAL_DISPATCH";
    let statusCode = 200;
    let latencyMs = 12;
    let responseBody = "Acknowledged by internal ledger and event bus";

    if (targetUrl && targetUrl.startsWith("http")) {
      const startTime = Date.now();
      try {
        const res = await fetch(targetUrl, {
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
      ledger: qrisLedger.getState(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to simulate payment webhook" },
      { status: 500 },
    );
  }
}
