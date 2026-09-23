import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { saveTenantBranding, verifyCustomDomain } from "@/lib/tenant-branding";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;

    const tenantId = (await effectiveTenantId(session!)) || "default";
    const body = await req.json();
    const { domain } = body;

    if (!domain) {
      return NextResponse.json({ error: "Domain is required" }, { status: 400 });
    }

    const verification = verifyCustomDomain(domain);
    if (!verification.success) {
      return NextResponse.json(verification, { status: 400 });
    }

    // Persist verified state
    saveTenantBranding(tenantId, {
      customDomain: domain,
      domainStatus: verification.status,
      sslActive: verification.sslActive,
      cnameTarget: verification.cnameTarget,
    });

    return NextResponse.json(verification);
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to verify domain" }, { status: 500 });
  }
}
