import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { listBeneficiaries } from "@/lib/beneficiary-store";

export async function GET(request: Request) {
  try {
    const { session, response } = await requireAuth(request);
    if (response) return response;
    const tenantId = await effectiveTenantId(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const beneficiaries = await listBeneficiaries(tenantId, search);
    return NextResponse.json({ success: true, beneficiaries });
  } catch (error) {
    console.error("Error fetching beneficiaries:", error);
    return NextResponse.json({ error: "Failed to fetch beneficiaries" }, { status: 500 });
  }
}
