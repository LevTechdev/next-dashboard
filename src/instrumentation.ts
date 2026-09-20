import { registerOTel } from "@vercel/otel";

/**
 * Next.js instrumentation hook — the single startup entry point Next loads.
 *
 * Next looks for this file beside the app directory, so for this project it is
 * `src/instrumentation.ts` that runs; a root-level `instrumentation.ts` is not
 * merged, it is ignored. Startup work must therefore hang off this one file:
 *
 *  - Edge: OpenTelemetry only.
 *  - Node: OpenTelemetry plus the fs-backed startup in ./instrumentation.node,
 *    imported dynamically behind the runtime check so the Edge build never
 *    traces the scheduler or the ledger store.
 */
export async function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || "next-dashboard",
  });

  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { registerNodeInstrumentation } = await import("./instrumentation.node");
  await registerNodeInstrumentation();
}

export const onRequestError = async (...args: unknown[]) => {
  // Hook for @vercel/otel error reporting; kept minimal here.
  void args;
};
