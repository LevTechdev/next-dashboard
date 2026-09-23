import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { requirePermission } from "@/lib/api-guard";
import { writeDeletionAudit } from "@/lib/activity-audit";
import { ALL_ROLES, ADMIN_MANAGED_ROLES, type Role } from "@/lib/permissions";

/**
 * Role-assignment guard: ONLY admins may set roles, and only from the
 * admin-managed set. SUPER_ADMIN was merged into ADMIN — the value is
 * rejected here so the workspace stays on the unified role set (legacy DB
 * rows keep working through normalizeRole at the permission boundary).
 * Self-service signups get CLIENT from the auth routes; workspace roles exist
 * solely because an admin created them here.
 */
function guardRoleAssignment(bodyRole: unknown): { role?: Role; error?: string } {
  if (bodyRole == null) return {}; // no role in the payload — leave untouched
  if (!ALL_ROLES.includes(bodyRole as Role)) {
    return { error: `Unknown role: ${String(bodyRole)}` };
  }
  if (!(ADMIN_MANAGED_ROLES as string[]).includes(bodyRole as string)) {
    return { error: "This role cannot be assigned manually" };
  }
  return { role: bodyRole as Role };
}

export async function GET(req: Request) {
  const { response } = await requirePermission("read", "team", req);
  if (response) return response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      position: true,
      isActive: true,
      avatar: true,
      createdAt: true,
    },
  });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const { session, response } = await requirePermission("create", "team", req);
  if (response) return response;

  const body = await req.json();
  const roleCheck = guardRoleAssignment(body.role ?? "STAFF");
  if (roleCheck.error) {
    return NextResponse.json({ error: roleCheck.error }, { status: 400 });
  }
  const hashedPassword = await hash(body.password || "default123", 10);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      password: hashedPassword,
      role: roleCheck.role ?? "STAFF",
      position: body.position,
      phone: body.phone,
      tenantId: session!.user.tenantId,
    },
  });
  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}

export async function PUT(req: Request) {
  const { session, response } = await requirePermission("update", "team", req);
  if (response) return response;

  const body = await req.json();
  const roleCheck = guardRoleAssignment(body.role);
  if (roleCheck.error) {
    return NextResponse.json({ error: roleCheck.error }, { status: 400 });
  }
  // Admins cannot change their own role (no self-demotion/escalation).
  if (body.id === session!.user.id && roleCheck.role && roleCheck.role !== "ADMIN") {
    return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
  }
  const data: any = {
    name: body.name,
    position: body.position,
    isActive: body.isActive,
  };
  if (roleCheck.role) data.role = roleCheck.role;
  if (body.email != null) data.email = body.email;
  if (body.password) data.password = await hash(body.password, 10);
  const user = await prisma.user.update({ where: { id: body.id }, data });
  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}

export async function DELETE(req: Request) {
  const { session, response } = await requirePermission("delete", "team", req);
  if (response) return response;

  const { id } = await req.json();
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (id === session!.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself from the team" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });

  await writeDeletionAudit({
    session: session!,
    action: "DELETE_TEAM_MEMBER",
    entity: "User",
    entityId: id,
    details: `Team member ${existing.name} (${existing.email}) removed`,
    req,
  });

  return NextResponse.json({ success: true });
}
