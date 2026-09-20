import { registerOTel } from "@vercel/otel";
import { registerQrisLedgerPersistence } from "./lib/qris-ledger-store";

/**
 * Next.js instrumentation hook — Node.js runtime variant.
 * Runs once at server startup in the Node.js runtime. Registers OpenTelemetry
 * and hydrates the QRIS income ledger from disk, attaching the persistence
 * hook so transactions/disbursements survive server restarts. Kept separate
 * from instrumentation.ts (which also builds for Edge) so the Edge build never
 * traces the fs/path imports in qris-ledger-store.
 */
export function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || "next-dashboard",
  });
  registerQrisLedgerPersistence();
}
