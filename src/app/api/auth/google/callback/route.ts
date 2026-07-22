import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, type AuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:3010/api/auth/google/callback";

/**
 * GET /api/auth/google/callback?code=xxx
 *
 * Handles the OAuth callback from Google after user consent.
 * Google redirects here via browser GET with the authorization code.
 * Exchanges the code for tokens, finds/creates a user, sets JWT cookie,
 * and redirects to the dashboard.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    // Handle error from Google (e.g. user denied consent)
    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.redirect(
        new URL(`/en/login?error=google_${error}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/en/login?error=missing_code", request.url)
      );
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.redirect(
        new URL("/en/login?error=google_not_configured", request.url)
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Google token exchange failed:", errorData);
      return NextResponse.redirect(
        new URL("/en/login?error=token_exchange_failed", request.url)
      );
    }

    const tokens = await tokenResponse.json();
    const { id_token, access_token } = tokens;

    // Get user info from Google
    let userInfo: { email: string; name: string; picture?: string };
    if (id_token) {
      // Decode the ID token (JWT) to get user info
      const payload = JSON.parse(
        Buffer.from(id_token.split(".")[1], "base64").toString()
      );
      userInfo = {
        email: payload.email,
        name: payload.name || payload.email.split("@")[0],
        picture: payload.picture,
      };
    } else {
      // Fallback: use access token to fetch user info
      const infoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      userInfo = await infoResponse.json();
    }

    if (!userInfo.email) {
      return NextResponse.redirect(
        new URL("/en/login?error=no_email", request.url)
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: userInfo.email },
    });

    if (!user) {
      // Auto-create user from Google profile
      user = await prisma.user.create({
        data: {
          name: userInfo.name,
          email: userInfo.email,
          password: "", // Google-authenticated users have no password
          role: "STAFF",
          isActive: true,
          avatar: userInfo.picture || null,
          emailVerified: new Date(), // Google emails are pre-verified
        },
      });
    }

    // Create JWT token
    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    const token = signToken(authUser);

    // Redirect to dashboard with JWT cookie set
    const dashboardUrl = new URL("/en/dashboard", request.url);
    const response = NextResponse.redirect(dashboardUrl);

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/en/login?error=callback_failed", request.url)
    );
  }
}
