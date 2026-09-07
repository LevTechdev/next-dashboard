import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { getTenantBranding, saveTenantBranding } from "@/lib/tenant-branding";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;

    const tenantId = (await effectiveTenantId(session!)) || "default";
    const branding = getTenantBranding(tenantId);

    return NextResponse.json({ branding });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch tenant branding" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;

    const tenantId = (await effectiveTenantId(session!)) || "default";
    const body = await req.json();

    const updated = saveTenantBranding(tenantId, body);
    return NextResponse.json({ branding: updated });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to save tenant branding" }, { status: 500 });
  }
}
