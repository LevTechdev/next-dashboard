import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

// In-memory persistent invitations store for workspace team members
interface TeamInvitationRecord {
  id: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "STAFF" | "VIEWER";
  allowedChannels: string[];
  invitedBy: string;
  token: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  createdAt: string;
}

let invitationsStore: TeamInvitationRecord[] = [
  {
    id: "inv-901",
    email: "alex.dev@partner.com",
    role: "MANAGER",
    allowedChannels: ["Online Store", "Instagram"],
    invitedBy: "Admin",
    token: "tok_901_alpha",
    status: "pending",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
  {
    id: "inv-902",
    email: "clara.growth@agency.io",
    role: "STAFF",
    allowedChannels: ["TikTok Shop", "Instagram"],
    invitedBy: "Admin",
    token: "tok_902_beta",
    status: "pending",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: "inv-903",
    email: "sam.analytics@consulting.co",
    role: "VIEWER",
    allowedChannels: ["Online Store", "Shopify", "Facebook"],
    invitedBy: "Sarah Johnson",
    token: "tok_903_gamma",
    status: "accepted",
    expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
  },
];

export async function GET(req: Request) {
  try {
    const { session, response } = await requirePermission("read", "team", req);
    if (response) return response;

    return NextResponse.json({
      invitations: invitationsStore,
    });
  } catch (error) {
    console.error("GET team invitations error:", error);
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { session, response } = await requirePermission("create", "team", req);
    if (response) return response;

    const body = await req.json();
    const { email, role, allowedChannels, expiresInDays = 7 } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
    }

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const newInvitation: TeamInvitationRecord = {
      id: `inv-${Date.now()}`,
      email: email.toLowerCase().trim(),
      role: role || "STAFF",
      allowedChannels:
        Array.isArray(allowedChannels) && allowedChannels.length > 0
          ? allowedChannels
          : ["All Channels"],
      invitedBy: session?.user?.name || "Workspace Admin",
      token,
      status: "pending",
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    invitationsStore.unshift(newInvitation);

    // Attempt to send email via Resend / mailer
    const host = req.headers.get("host") || "localhost:3010";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const inviteUrl = `${protocol}://${host}/en/register?invite=${token}`;

    try {
      await sendEmail({
        to: newInvitation.email,
        subject: `You've been invited to join ${session?.user?.name || "the team"} on LevTech Dashboard`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #18181b;">Team Invitation</h2>
            <p>You have been invited to collaborate as a <strong>${newInvitation.role}</strong> with access to: <em>${newInvitation.allowedChannels.join(", ")}</em>.</p>
            <p>Click below to accept your invitation:</p>
            <a href="${inviteUrl}" style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Accept Invitation</a>
            <p style="color: #71717a; font-size: 12px; margin-top: 24px;">This invitation will expire in ${expiresInDays} days.</p>
          </div>
        `,
        text: `You have been invited to join ${session?.user?.name || "the team"} on LevTech Dashboard as a ${newInvitation.role} with access to: ${newInvitation.allowedChannels.join(", ")}.\n\nAccept your invitation here: ${inviteUrl}\n\nThis invitation will expire in ${expiresInDays} days.`,
      });
    } catch (e) {
      console.warn(
        "Could not dispatch invitation email via mailer (mock dev mode):",
        (e as any)?.message,
      );
    }

    return NextResponse.json({
      success: true,
      invitation: newInvitation,
      inviteUrl,
    });
  } catch (error) {
    console.error("POST team invitation error:", error);
    return NextResponse.json({ error: "Failed to send team invitation" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { response } = await requirePermission("delete", "team", req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing invitation ID" }, { status: 400 });
    }

    invitationsStore = invitationsStore.filter((inv) => inv.id !== id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE team invitation error:", error);
    return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { response } = await requirePermission("update", "team", req);
    if (response) return response;

    const body = await req.json();
    const { id, role, allowedChannels, expiresInDays } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing invitation ID" }, { status: 400 });
    }

    const index = invitationsStore.findIndex((inv) => inv.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    const current = invitationsStore[index];
    const updated: TeamInvitationRecord = {
      ...current,
      role: role || current.role,
      allowedChannels:
        Array.isArray(allowedChannels) && allowedChannels.length > 0
          ? allowedChannels
          : current.allowedChannels,
      expiresAt: expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : current.expiresAt,
    };

    invitationsStore[index] = updated;

    return NextResponse.json({ success: true, invitation: updated });
  } catch (error) {
    console.error("PATCH team invitation error:", error);
    return NextResponse.json({ error: "Failed to update invitation" }, { status: 500 });
  }
}
