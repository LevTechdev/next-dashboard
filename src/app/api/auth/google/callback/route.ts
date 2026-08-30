import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, type AuthUser } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3010/api/auth/google/callback";

/**
 * Verify a Google ID token by checking its signature against Google's public keys.
 * Falls back to basic decoding if verification fails (e.g. in dev).
 */
async function verifyIdToken(idToken: string): Promise<Record<string, unknown> | null> {
  try {
    // Decode the header to get the key ID
    const [headerB64] = idToken.split(".");
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());

    // Fetch Google's public keys
    const keysResponse = await fetch("https://www.googleapis.com/oauth2/v3/certs");
    if (!keysResponse.ok) return null;
    const { keys } = await keysResponse.json();

    // Find the matching key
    const key = keys?.find((k: { kid?: string }) => k.kid === header.kid);
    if (!key) return null;

    // Verify using Web Crypto API
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const parts = idToken.split(".");
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = new Uint8Array(
      Buffer.from(parts[2], "base64url"),
    );

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signature,
      data,
    );

    if (!valid) return null;

    // Return decoded payload
    return JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch (err) {
    console.error("ID token verification failed:", err);
    return null;
  }
}

/**
 * GET /api/auth/google/callback?code=xxx&state=xxx
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
    const state = searchParams.get("state");

    // Handle error from Google (e.g. user denied consent)
    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.redirect(new URL(`/en/login?error=google_${error}`, request.url));
    }

    // ── CSRF state validation ──
    // The state cookie is set by /api/auth/google (same-site, short-lived).
    // If missing or mismatched, the callback is likely a CSRF attack.
    const stateCookie = request.headers.get("cookie")?.match(/google_oauth_state=([^;]+)/)?.[1];
    if (!state || !stateCookie || state !== stateCookie) {
      console.error("Google OAuth state mismatch — possible CSRF attempt", {
        hasState: !!state,
        hasCookie: !!stateCookie,
      });
      return NextResponse.redirect(new URL("/en/login?error=invalid_state", request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/en/login?error=missing_code", request.url));
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.redirect(new URL("/en/login?error=google_not_configured", request.url));
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Google token exchange failed:", errorData);
      return NextResponse.redirect(new URL("/en/login?error=token_exchange_failed", request.url));
    }

    const tokens = await tokenResponse.json();
    const { id_token, access_token } = tokens;

    // ── Get user info from Google ──
    let userInfo: { email: string; name: string; picture?: string };
    if (id_token) {
      // Verify the ID token signature against Google's public keys
      const payload = await verifyIdToken(id_token);
      if (!payload?.email) {
        return NextResponse.redirect(new URL("/en/login?error=invalid_id_token", request.url));
      }
      userInfo = {
        email: payload.email as string,
        name: (payload.name as string) || (payload.email as string).split("@")[0],
        picture: payload.picture as string | undefined,
      };
    } else {
      // Fallback: use access token to fetch user info
      const infoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!infoResponse.ok) {
        return NextResponse.redirect(new URL("/en/login?error=userinfo_failed", request.url));
      }
      userInfo = await infoResponse.json();
    }

    if (!userInfo.email) {
      return NextResponse.redirect(new URL("/en/login?error=no_email", request.url));
    }

    // ── Find or create user ──
    let user = await prisma.user.findUnique({
      where: { email: userInfo.email },
    });

    if (!user) {
      // Auto-create user from Google profile
      // Assign to the default tenant (matches register route behavior)
      const defaultTenant = await prisma.tenant.findUnique({ where: { slug: "default" } });

      user = await prisma.user.create({
        data: {
          name: userInfo.name,
          email: userInfo.email,
          password: "", // Google-authenticated users have no password
          role: "STAFF",
          isActive: true,
          avatar: userInfo.picture || null,
          emailVerified: new Date(), // Google emails are pre-verified
          tenantId: defaultTenant?.id ?? null,
        },
      });

      // Log the account creation
      await prisma.auditLog.create({
        data: {
          action: "GOOGLE_SIGNUP",
          entity: "User",
          entityId: user.id,
          details: `New account created via Google OAuth: ${userInfo.email}`,
          tenantId: defaultTenant?.id ?? null,
        },
      });
    }

    // ── Create JWT token ──
    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
    const token = signToken(authUser);

    // ── Create session record ──
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Log the login
    await prisma.auditLog.create({
      data: {
        action: "GOOGLE_LOGIN",
        entity: "User",
        entityId: user.id,
        details: `Logged in via Google OAuth`,
        tenantId: user.tenantId,
      },
    });

    // ── Redirect to dashboard with JWT cookie set ──
    const dashboardUrl = new URL("/en/dashboard", request.url);
    const response = NextResponse.redirect(dashboardUrl);

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    // Clear the state cookie
    response.cookies.set("google_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(new URL("/en/login?error=callback_failed", request.url));
  }
}
