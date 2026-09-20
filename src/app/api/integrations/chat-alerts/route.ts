import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { writeDeletionAudit } from "@/lib/activity-audit";
import {
  getChatConfig,
  upsertChatChannel,
  deleteChatChannel,
  updateChatRules,
} from "@/lib/chat-alerts-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getChatConfig();
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
    const body = await req.json();

    // Check if updating rules
    if (body.action === "update_rules") {
      const updatedRules = updateChatRules(body.rules);
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

    const channel = upsertChatChannel({
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
    const { session, response } = await requireAuth(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing channel id" }, { status: 400 });
    }

    const channel = getChatConfig().channels.find((c) => c.id === id);
    const deleted = deleteChatChannel(id);
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
