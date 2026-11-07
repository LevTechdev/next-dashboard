import { requireAuth } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { qrisEmitter } from "@/lib/qris-engine";
import { loadQrisLedger } from "@/lib/qris-ledger-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/qris/stream
 * Server-Sent Events (SSE) stream for real-time auto-sensing QRIS payments & disbursements.
 * Events carry a tenantId and are filtered to the authenticated workspace.
 */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const tenantId = await effectiveTenantId(session);
  if (!tenantId) {
    return new Response(JSON.stringify({ error: "No workspace for this account" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ledger = await loadQrisLedger(tenantId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const initialPayload = JSON.stringify({
        type: "INIT_STATE",
        data: ledger.getState(),
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`event: init\ndata: ${initialPayload}\n\n`));

      const forward = (event: string, data: unknown) => {
        // Never leak another workspace's transactions into this stream.
        if (!data || typeof data !== "object") return;
        if ((data as { tenantId?: string | null }).tenantId !== tenantId) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream closed
        }
      };

      const onPaymentConfirmed = (data: unknown) => forward("payment_confirmed", data);
      const onTransactionCreated = (data: unknown) => forward("transaction_created", data);
      const onWithdrawalCompleted = (data: unknown) => forward("withdrawal_completed", data);

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
