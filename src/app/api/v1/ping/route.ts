import { authenticateApiKey, v1Error, v1Json } from "@/lib/api-key-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/ping — smoke-test a key without touching workspace data.
 * Confirms the key exists, is ACTIVE, unexpired, within its IP allowlist,
 * and under the sandbox rate limit.
 */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return v1Error(auth.status, auth.error, auth.hint);

  return v1Json(
    {
      pong: true,
      key: { name: auth.keyName, scopes: auth.scopes },
      timestamp: new Date().toISOString(),
    },
    auth.rateRemaining,
  );
}
