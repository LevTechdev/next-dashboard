import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/api-guard";
import { getTenantId } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

const stripPem = (cert: string) =>
  String(cert)
    .replace(/-----(BEGIN|END) CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

/**
 * Resolve the tenant the caller manages. Sessions normally carry a tenant
 * claim; legacy/single-tenant sessions (e.g. the seeded admin) don't, and are
 * treated as operating on the default workspace — the same semantic that
 * scripts/backfill-tenant.mjs applies when backfilling null-tenant rows.
 */
async function effectiveTenantId(session: { user: { tenantId?: string | null } }) {
  const tenantId = getTenantId(session);
  if (tenantId) return tenantId;
  const fallback = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  return fallback?.id ?? null;
}

/** GET: the caller tenant's SSO connection (IdP cert redacted). ADMIN/AUDITOR. */
export async function GET(req: Request) {
  const { session, response } = await requirePermission("read", "settings", req);
  if (response) return response;
  const tenantId = await effectiveTenantId(session!);
  if (!tenantId) return NextResponse.json({ error: "No tenant context" }, { status: 400 });

  const conn = await prisma.ssoConnection.findUnique({ where: { tenantId } });
  if (!conn) return NextResponse.json(null);

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  return NextResponse.json({
    id: conn.id,
    name: conn.name,
    entryPoint: conn.entryPoint,
    spIssuer: conn.spIssuer,
    emailDomain: conn.emailDomain,
    enabled: conn.enabled,
    idpCertConfigured: Boolean(conn.idpCert),
    tenantSlug: tenant?.slug ?? null,
  });
}

/**
 * POST: create/update the caller tenant's SSO connection. ADMIN only.
 * The IdP certificate is only required on first setup — when an existing
 * connection is updated without a new certificate, the stored one is kept
 * (so admins can fix entryPoint/name without re-pasting the cert).
 */
export async function POST(req: Request) {
  const { session, response } = await requirePermission("update", "settings", req);
  if (response) return response;
  const tenantId = await effectiveTenantId(session!);
  if (!tenantId) return NextResponse.json({ error: "No tenant context" }, { status: 400 });

  const body = await req.json();
  const { name, entryPoint, idpCert, spIssuer, emailDomain, enabled } = body;
  if (!name || !entryPoint) {
    return NextResponse.json(
      { error: "name and entryPoint are required" },
      { status: 400 },
    );
  }

  let cert = idpCert ? stripPem(idpCert) : "";
  if (!cert) {
    // Preserve the existing certificate on update when none is provided.
    const existing = await prisma.ssoConnection.findUnique({ where: { tenantId } });
    cert = existing?.idpCert ?? "";
    if (!cert) {
      return NextResponse.json(
        { error: "idpCert is required on first setup" },
        { status: 400 },
      );
    }
  }

  const data = {
    name: String(name),
    entryPoint: String(entryPoint),
    idpCert: cert,
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

/** PATCH: partial update (e.g. enable/disable toggle). ADMIN only. */
export async function PATCH(req: Request) {
  const { session, response } = await requirePermission("update", "settings", req);
  if (response) return response;
  const tenantId = await effectiveTenantId(session!);
  if (!tenantId) return NextResponse.json({ error: "No tenant context" }, { status: 400 });

  const existing = await prisma.ssoConnection.findUnique({ where: { tenantId } });
  if (!existing) {
    return NextResponse.json({ error: "No SSO connection configured" }, { status: 404 });
  }

  const body = await req.json();
  const data: {
    name?: string;
    entryPoint?: string;
    spIssuer?: string;
    emailDomain?: string | null;
    enabled?: boolean;
  } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.entryPoint === "string" && body.entryPoint.trim())
    data.entryPoint = body.entryPoint.trim();
  if (typeof body.spIssuer === "string") data.spIssuer = body.spIssuer.trim() || "next-dashboard";
  if (body.emailDomain !== undefined) {
    data.emailDomain = body.emailDomain ? String(body.emailDomain).toLowerCase() : null;
  }
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const conn = await prisma.ssoConnection.update({ where: { tenantId }, data });
  return NextResponse.json({ id: conn.id, name: conn.name, enabled: conn.enabled });
}

/** DELETE: remove the caller tenant's SSO connection (disables SSO). ADMIN only. */
export async function DELETE(req: Request) {
  const { session, response } = await requirePermission("update", "settings", req);
  if (response) return response;
  const tenantId = await effectiveTenantId(session!);
  if (!tenantId) return NextResponse.json({ error: "No tenant context" }, { status: 400 });

  await prisma.ssoConnection.deleteMany({ where: { tenantId } });
  return NextResponse.json({ deleted: true });
}
