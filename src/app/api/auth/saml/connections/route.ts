import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/api-guard";
import { getTenantId } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

/** GET: the caller tenant's SSO connection (IdP cert redacted). ADMIN/AUDITOR. */
export async function GET(req: Request) {
  const { session, response } = await requirePermission("read", "settings", req);
  if (response) return response;
  const tenantId = getTenantId(session!);
  if (!tenantId) return NextResponse.json({ error: "No tenant context" }, { status: 400 });

  const conn = await prisma.ssoConnection.findUnique({ where: { tenantId } });
  if (!conn) return NextResponse.json(null);
  return NextResponse.json({
    id: conn.id,
    name: conn.name,
    entryPoint: conn.entryPoint,
    spIssuer: conn.spIssuer,
    emailDomain: conn.emailDomain,
    enabled: conn.enabled,
    idpCertConfigured: Boolean(conn.idpCert),
  });
}

/** POST: create/update the caller tenant's SSO connection. ADMIN only. */
export async function POST(req: Request) {
  const { session, response } = await requirePermission("update", "settings", req);
  if (response) return response;
  const tenantId = getTenantId(session!);
  if (!tenantId) return NextResponse.json({ error: "No tenant context" }, { status: 400 });

  const body = await req.json();
  const { name, entryPoint, idpCert, spIssuer, emailDomain, enabled } = body;
  if (!name || !entryPoint || !idpCert) {
    return NextResponse.json(
      { error: "name, entryPoint and idpCert are required" },
      { status: 400 },
    );
  }

  const data = {
    name: String(name),
    entryPoint: String(entryPoint),
    idpCert: String(idpCert)
      .replace(/-----(BEGIN|END) CERTIFICATE-----/g, "")
      .replace(/\s+/g, ""),
    spIssuer: spIssuer ? String(spIssuer) : "next-dashboard",
    emailDomain: emailDomain ? String(emailDomain).toLowerCase() : null,
    enabled: enabled ?? true,
  };

  const conn = await prisma.ssoConnection.upsert({
    where: { tenantId },
    update: data,
    create: { tenantId, ...data },
  });
  return NextResponse.json({ id: conn.id, name: conn.name, enabled: conn.enabled });
}
