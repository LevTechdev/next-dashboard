import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { toCEF, toSiemJSON } from "@/lib/siem";

export const dynamic = "force-dynamic";

/**
 * GET /api/security/audit/export?format=json|ndjson|cef&limit=N — ADMIN/AUDITOR.
 * Pull-based SIEM export of the security audit trail. Pairs with the real-time
 * push in logSecurityEvent (SIEM_WEBHOOK_URL) and OTLP traces (instrumentation).
 */
export async function GET(req: Request) {
  const { response } = await requirePermission("read", "settings", req);
  if (response) return response;

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const limit = Math.min(Number(url.searchParams.get("limit")) || 1000, 5000);

  const events = await prisma.securityEvent.findMany({
    orderBy: { seq: "asc" },
    take: limit,
    select: {
      id: true,
      seq: true,
      userId: true,
      type: true,
      ip: true,
      userAgent: true,
      metadata: true,
      createdAt: true,
    },
  });

  if (format === "cef") {
    const body = events.map(toCEF).join("\n") + (events.length ? "\n" : "");
    return new NextResponse(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (format === "ndjson") {
    const body =
      events.map((e) => JSON.stringify(toSiemJSON(e))).join("\n") + (events.length ? "\n" : "");
    return new NextResponse(body, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8" },
    });
  }
  return NextResponse.json({ count: events.length, events: events.map(toSiemJSON) });
}
