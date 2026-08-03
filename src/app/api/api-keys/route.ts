import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function generateApiKey(): { key: string; prefix: string; hashedKey: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const prefix = `dash_${raw.slice(0, 8)}...`;
  const key = `dash_${raw}`;
  const hashedKey = crypto.createHash("sha256").update(key).digest("hex");
  return { key, prefix, hashedKey };
}

export async function GET(req: Request) {
  const { response } = await requirePermission("read", "integrations", req);
  if (response) return response;

  const apiKeys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      permissions: true,
      ipAllowlist: true,
      status: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(apiKeys);
}

export async function POST(req: Request) {
  const { response } = await requirePermission("create", "integrations", req);
  if (response) return response;

  const body = await req.json();
  const { name, permissions, expiresInDays, ipAllowlist } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { key, prefix, hashedKey } = generateApiKey();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  const allowlist: string[] = Array.isArray(ipAllowlist)
    ? ipAllowlist.map((s: unknown) => String(s).trim()).filter(Boolean)
    : typeof ipAllowlist === "string" && ipAllowlist.trim()
      ? ipAllowlist
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

  const { session } = await requireAuth(req);
  const userId = session.user.id;

  const apiKey = await prisma.apiKey.create({
    data: {
      name: name.trim(),
      key: hashedKey,
      prefix,
      permissions: permissions || "read",
      ipAllowlist: allowlist,
      status: "ACTIVE",
      expiresAt,
      userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_API_KEY",
      entity: "ApiKey",
      entityId: apiKey.id,
      details: `Created API key "${name}" with ${permissions || "read"} permissions`,
    },
  });

  // Return the raw key once — it won't be shown again
  return NextResponse.json({
    id: apiKey.id,
    name: apiKey.name,
    prefix: apiKey.prefix,
    key, // ← raw key, only returned on creation
    permissions: apiKey.permissions,
    ipAllowlist: apiKey.ipAllowlist,
    status: apiKey.status,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
  });
}

export async function DELETE(req: Request) {
  const { response } = await requirePermission("delete", "integrations", req);
  if (response) return response;

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  await prisma.apiKey.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      action: "DELETE_API_KEY",
      entity: "ApiKey",
      entityId: id,
      details: `Deleted API key "${key.name}"`,
    },
  });

  return NextResponse.json({ success: true });
}

export async function PUT(req: Request) {
  const { response } = await requirePermission("update", "integrations", req);
  if (response) return response;

  const body = await req.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }

  const updated = await prisma.apiKey.update({
    where: { id },
    data: { status },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_API_KEY",
      entity: "ApiKey",
      entityId: id,
      details: `${status === "REVOKED" ? "Revoked" : "Reactivated"} API key "${updated.name}"`,
    },
  });

  return NextResponse.json(updated);
}
