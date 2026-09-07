import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest, getTokenFromCookie, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Extract token from Authorization header or cookie
    const token = getTokenFromRequest(req) || getTokenFromCookie(req);
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // Fetch fresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        position: true,
        avatar: true,
        role: true,
        isActive: true,
        totpEnabled: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const token = getTokenFromRequest(req) || getTokenFromCookie(req);
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const { name, phone, position, avatar } = body;

    const updatedUser = await prisma.user.update({
      where: { id: decoded.id },
      data: { name, phone, position, avatar },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        position: true,
        avatar: true,
        role: true,
        isActive: true,
        totpEnabled: true,
        emailVerified: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Update me error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
