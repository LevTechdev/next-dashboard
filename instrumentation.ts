export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startScheduler } = await import("@/lib/scheduler");
  await startScheduler();
}

export const onRequestError = async (...args: unknown[]) => {
  // Hook for @vercel/otel error reporting; kept minimal here.
  void args;
};
