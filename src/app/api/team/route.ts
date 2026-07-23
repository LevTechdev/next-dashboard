import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { requirePermission } from "@/lib/api-guard";

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
  const { response } = await requirePermission("create", "team");
  if (response) return response;

  const body = await req.json();
  const hashedPassword = await hash(body.password || "default123", 10);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      password: hashedPassword,
      role: body.role || "STAFF",
      position: body.position,
      phone: body.phone,
    },
  });
  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}

export async function PUT(req: Request) {
  const { response } = await requirePermission("update", "team");
  if (response) return response;

  const body = await req.json();
  const data: any = {
    name: body.name,
    email: body.email,
    role: body.role,
    position: body.position,
    isActive: body.isActive,
  };
  if (body.password) data.password = await hash(body.password, 10);
  const user = await prisma.user.update({ where: { id: body.id }, data });
  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}

export async function DELETE(req: Request) {
  const { response } = await requirePermission("delete", "team");
  if (response) return response;

  const { id } = await req.json();
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
