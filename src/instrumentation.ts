import { registerOTel } from "@vercel/otel";

/**
 * Next.js instrumentation hook — runs once at server startup.
 * Registers OpenTelemetry. Traces are exported via OTLP when
 * OTEL_EXPORTER_OTLP_ENDPOINT is set (e.g. an OpenTelemetry Collector that
 * fans out to a SIEM/APM); otherwise spans are created but not exported.
 */
export function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || "next-dashboard",
  });
}
