import { registerOTel } from "@vercel/otel";

/**
 * Next.js instrumentation hook — Edge runtime variant.
 * Runs once at server startup in the Edge runtime; registers OpenTelemetry.
 * Node-only concerns (fs-backed stores) live in instrumentation.node.ts so
 * this Edge build never traces Node.js modules.
 */
export function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || "next-dashboard",
  });
}
