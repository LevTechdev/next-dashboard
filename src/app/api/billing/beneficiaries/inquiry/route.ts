import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { inquireAccountName } from "@/lib/beneficiary-store";

export async function POST(request: Request) {
  try {
    const { session, response } = await requireAuth(request);
    if (response) return response;
    const tenantId = await effectiveTenantId(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
    }

    const body = await request.json();
    const accountNumber = body.accountNumber || body.account;
    const channel = body.channel || body.method;
    const bankCode = body.bankCode;

    if (!accountNumber || typeof accountNumber !== "string") {
      return NextResponse.json({ error: "Account number is required" }, { status: 400 });
    }

    const inquiry = await inquireAccountName(tenantId, accountNumber, channel, bankCode);
    return NextResponse.json(inquiry);
  } catch (error) {
    console.error("Account inquiry error:", error);
    return NextResponse.json({ error: "Failed to perform account inquiry" }, { status: 500 });
  }
}
