import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, signToken, type AuthUser } from "@/lib/auth";
import { TOTP } from "otplib";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, totpToken } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is deactivated" },
        { status: 403 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // If user has 2FA enabled, verify the TOTP token
    if (user.totpEnabled && user.totpSecret) {
      if (!totpToken) {
        return NextResponse.json(
          { requires2FA: true, message: "TOTP verification code required" },
          { status: 200 }
        );
      }

      const totp = new TOTP();
      const isTotpValid = totp.verify(totpToken, { secret: user.totpSecret });
      if (!isTotpValid) {
        return NextResponse.json(
          { error: "Invalid two-factor authentication code" },
          { status: 401 }
        );
      }
    }

    // Create JWT token
    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    const token = signToken(authUser);

    // Return token and user data (without password)
    const { password: _, totpSecret, ...safeUser } = user;

    const response = NextResponse.json({
      token,
      user: safeUser,
      message: "Login successful",
    });

    // Set cookie for middleware-based auth
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    );
  }
}
