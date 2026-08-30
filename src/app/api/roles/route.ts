import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { response } = await requirePermission("read", "roles", req);
  if (response) return response;

  const roleSettings = await prisma.roleSetting.findMany({
    orderBy: [{ role: "asc" }, { resource: "asc" }, { action: "asc" }],
  });

  // Also fetch all users with their roles for the role overview
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json({ roleSettings, users });
}

export async function PUT(req: Request) {
  const { response } = await requirePermission("update", "roles");
  if (response) return response;
  const { session } = await requireAuth(req);

  const body = await req.json();
  const { id, allowed } = body;

  if (!id || allowed === undefined) {
    return NextResponse.json({ error: "Missing id or allowed" }, { status: 400 });
  }

  const updated = await prisma.roleSetting.update({
    where: { id },
    data: { allowed },
  });

  // Log the change to audit log
  await prisma.auditLog.create({
    data: {
      action: "UPDATE_ROLE_PERMISSION",
      entity: "RoleSetting",
      entityId: id,
      details: `Changed ${updated.role} ${updated.resource}:${updated.action} to ${updated.allowed ? "ALLOW" : "DENY"}`,
      tenantId: session.user.tenantId,
    },
  });

  return NextResponse.json(updated);
}

export async function POST(req: Request) {
  const { response } = await requirePermission("create", "roles");
  if (response) return response;
  const { session } = await requireAuth(req);

  const body = await req.json();
  const { role, resource, action, allowed } = body;

  if (!role || !resource || !action) {
    return NextResponse.json(
      { error: "Missing required fields: role, resource, action" },
      { status: 400 },
    );
  }

  const setting = await prisma.roleSetting.upsert({
    where: { role_resource_action: { role, resource, action } },
    update: { allowed: allowed ?? true },
    create: { role, resource, action, allowed: allowed ?? true },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_ROLE_PERMISSION",
      entity: "RoleSetting",
      entityId: setting.id,
      details: `Created ${role} ${resource}:${action} = ${setting.allowed ? "ALLOW" : "DENY"}`,
      tenantId: session.user.tenantId,
    },
  });

  return NextResponse.json(setting);
}

export async function DELETE(req: Request) {
  const { response } = await requirePermission("delete", "roles");
  if (response) return response;
  const { session } = await requireAuth(req);

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await prisma.roleSetting.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      action: "DELETE_ROLE_PERMISSION",
      entity: "RoleSetting",
      entityId: id,
      details: `Deleted role permission setting`,
      tenantId: session.user.tenantId,
    },
  });

  return NextResponse.json({ success: true });
}
