import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { getTaxFilings } from "@/lib/fleet-tax-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;
    const tenantId = await effectiveTenantId(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
    }

    return NextResponse.json(await getTaxFilings(tenantId));
  } catch (error) {
    console.error("[TAX_FILINGS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch tax filings" }, { status: 500 });
  }
}
