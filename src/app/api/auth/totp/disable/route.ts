import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { compare } from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = session.user.id;

  const body = await req.json();
  const { password } = body;

  if (!password) {
    return NextResponse.json(
      { error: "Password is required" },
      { status: 400 }
    );
  }

  // Find the user
  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    user = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
    });
  }
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify password
  const isValid = await compare(password, user.password);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 403 });
  }

  // Disable 2FA and clear the secret
  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: false,
      totpSecret: null,
    },
  });

  return NextResponse.json({ success: true });
}
