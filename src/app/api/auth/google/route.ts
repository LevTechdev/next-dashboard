import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3010/api/auth/google/callback";

/**
 * GET /api/auth/google
 * Redirects the user to Google's OAuth consent screen.
 * Generates a random state parameter for CSRF protection.
 */
export async function GET() {
  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID in your .env file." },
      { status: 501 },
    );
  }

  // Generate a cryptographically random state parameter for CSRF protection
  const state = crypto.randomBytes(32).toString("hex");

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );

  // Store state in a cookie for CSRF validation in the callback
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60, // 10 minutes
    path: "/",
  });

  return response;
}
