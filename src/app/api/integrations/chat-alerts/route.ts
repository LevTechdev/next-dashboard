import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { validateOutboundUrl } from "@/lib/outbound-url";
import { writeDeletionAudit } from "@/lib/activity-audit";
import {
  getChatConfig,
  upsertChatChannel,
  deleteChatChannel,
  updateChatRules,
} from "@/lib/chat-alerts-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = await effectiveTenantId(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
    }

    const config = await getChatConfig(tenantId);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[CHAT_ALERTS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to retrieve chat alerts configuration" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = await effectiveTenantId(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
    }

    const body = await req.json();

    // Check if updating rules
    if (body.action === "update_rules") {
      const updatedRules = await updateChatRules(tenantId, body.rules);
      return NextResponse.json({ success: true, rules: updatedRules });
    }

    // Otherwise upserting a channel
    const { name, platform, webhookUrl, channelName, avatarUrl, enabledEvents, status, id } = body;

    if (!name || !platform || !webhookUrl) {
      return NextResponse.json(
        { error: "Missing required fields: name, platform, and webhookUrl" },
        { status: 400 },
      );
    }

    const validated = validateOutboundUrl(webhookUrl, { allowSimulated: true });
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const channel = await upsertChatChannel(tenantId, {
      id,
      name,
      platform,
      webhookUrl,
      channelName: channelName || (platform === "slack" ? "#general" : "Default Channel"),
      avatarUrl,
      enabledEvents: Array.isArray(enabledEvents) ? enabledEvents : ["stockout", "vip_order"],
      status: status || "ACTIVE",
    });

    return NextResponse.json({ success: true, channel });
  } catch (error) {
    console.error("[CHAT_ALERTS_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to save chat alert channel" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { session, response } = await requirePermission("delete", "integrations", req);
    if (response) return response;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = await effectiveTenantId(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing channel id" }, { status: 400 });
    }

    const config = await getChatConfig(tenantId);
    const channel = config.channels.find((c) => c.id === id);
    const deleted = await deleteChatChannel(tenantId, id);
    if (!deleted) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    await writeDeletionAudit({
      session,
      action: "DELETE_CHAT_ALERT_CHANNEL",
      entity: "ChatChannel",
      entityId: id,
      details: `Chat alert channel "${channel?.name ?? id}" (${channel?.platform ?? "unknown platform"}) deleted`,
      req,
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("[CHAT_ALERTS_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to delete chat alert channel" }, { status: 500 });
  }
}
