import { NextResponse } from "next/server";
import { getTokenFromRequest, getTokenFromCookie, verifyToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const token = getTokenFromRequest(req) ?? getTokenFromCookie(req);
    const user = token ? verifyToken(token) : null;
    const session = user ? { user } : null;
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { subscription } = await req.json();
    if (!subscription) {
      return new NextResponse("Missing subscription", { status: 400 });
    }

    // In a real app, save this to the database linked to the user
    console.log(`[PUSH] Subscribed user ${session.user.id}`, subscription);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push subscription error", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const token = getTokenFromRequest(req) ?? getTokenFromCookie(req);
    const user = token ? verifyToken(token) : null;
    const session = user ? { user } : null;
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { endpoint } = await req.json();
    
    // In a real app, delete this subscription from the database
    console.log(`[PUSH] Unsubscribed endpoint`, endpoint);

    return NextResponse.json({ success: true });
  } catch (error) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
