import { NextResponse } from "next/server";
import { qrisEmitter, qrisLedger } from "@/lib/qris-engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/qris/stream
 * Server-Sent Events (SSE) stream for real-time auto-sensing QRIS payments & disbursements.
 */
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat and ledger balance
      const initialPayload = JSON.stringify({
        type: "INIT_STATE",
        data: qrisLedger.getState(),
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`event: init\ndata: ${initialPayload}\n\n`));

      const onPaymentConfirmed = (data: any) => {
        try {
          const payload = `event: payment_confirmed\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // stream closed
        }
      };

      const onTransactionCreated = (data: any) => {
        try {
          const payload = `event: transaction_created\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // stream closed
        }
      };

      const onWithdrawalCompleted = (data: any) => {
        try {
          const payload = `event: withdrawal_completed\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // stream closed
        }
      };

      qrisEmitter.on("payment_confirmed", onPaymentConfirmed);
      qrisEmitter.on("transaction_created", onTransactionCreated);
      qrisEmitter.on("withdrawal_completed", onWithdrawalCompleted);

      // Heartbeat every 15s to keep connection alive through proxies
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        qrisEmitter.off("payment_confirmed", onPaymentConfirmed);
        qrisEmitter.off("transaction_created", onTransactionCreated);
        qrisEmitter.off("withdrawal_completed", onWithdrawalCompleted);
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
