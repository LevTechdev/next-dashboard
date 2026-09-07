import { NextResponse } from "next/server";
import {
  ChatPlatform,
  ChatAlertType,
  AlertPayloadData,
  buildSlackPayload,
  buildDiscordPayload,
  dispatchWebhook,
} from "@/lib/chat-alerts";
import { logDelivery } from "@/lib/chat-alerts-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      channelId = "test-channel",
      platform = "slack",
      webhookUrl,
      event = "stockout",
    } = body as {
      channelId?: string;
      platform: ChatPlatform;
      webhookUrl: string;
      event: ChatAlertType;
    };

    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Webhook URL is required for test dispatch" },
        { status: 400 },
      );
    }

    // 1. Prepare sample realistic event payload data
    let alertData: AlertPayloadData;

    switch (event) {
      case "vip_order":
        alertData = {
          type: "vip_order",
          data: {
            orderNumber: "ORD-2026-9842",
            customerName: "Sarah Jenkins",
            customerEmail: "s.jenkins@meridian-ventures.com",
            totalAmount: 1450.0,
            itemsCount: 5,
            channel: "TikTok Shop",
            actionUrl: "http://localhost:3010/orders",
          },
        };
        break;

      case "payment_failed":
        alertData = {
          type: "payment_failed",
          data: {
            orderNumber: "ORD-2026-9811",
            customerName: "Alexandre Dubois",
            customerEmail: "alex.dubois@lux-retail.fr",
            amount: 320.0,
            gateway: "Stripe",
            failureReason: "card_declined_insufficient_funds",
            actionUrl: "http://localhost:3010/integrations",
          },
        };
        break;

      case "daily_digest":
        alertData = {
          type: "daily_digest",
          data: {
            dateStr: new Date(Date.now() - 86400000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
            yesterdayGmv: 24850,
            ordersCount: 164,
            avgOrderValue: 151,
            newCustomersCount: 42,
            lowStockItemsCount: 3,
            topProductName: "Merino Wool Crewneck",
          },
        };
        break;

      case "stockout":
      default:
        alertData = {
          type: "stockout",
          data: {
            productName: "Classic Oxford Cotton Shirt",
            sku: "SHIRT-OXF-001",
            currentStock: 12,
            salesVelocity: 3.2,
            daysOfInventory: 3.8,
            leadTimeDays: 7,
            reorderPoint: 28,
            suggestedQty: 150,
            supplierName: "Apex Manufacturing Ltd.",
            actionUrl: "http://localhost:3010/inventory",
          },
        };
        break;
    }

    // 2. Format payload specific to platform
    const payload =
      platform === "slack" ? buildSlackPayload(alertData) : buildDiscordPayload(alertData);

    // 3. Dispatch to webhook endpoint
    const result = await dispatchWebhook(webhookUrl, platform, payload);

    // 4. Log the delivery receipt
    const isSimulated =
      webhookUrl.startsWith("mock://") ||
      webhookUrl.includes("example.com") ||
      webhookUrl.startsWith("simulation://");

    const deliveryRecord = logDelivery({
      channelId,
      platform,
      event,
      status: result.success ? (isSimulated ? "SIMULATED" : "DELIVERED") : "FAILED",
      statusCode: result.statusCode,
      durationMs: result.durationMs,
      payloadPreview:
        platform === "slack"
          ? (payload.text as string) || `Slack ${event}`
          : (payload.content as string) || `Discord ${event}`,
      responseText: result.responseText,
    });

    return NextResponse.json({
      success: result.success,
      statusCode: result.statusCode,
      durationMs: result.durationMs,
      payload,
      responseText: result.responseText,
      delivery: deliveryRecord,
      isSimulated,
    });
  } catch (error: any) {
    console.error("[CHAT_ALERTS_TEST_ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Failed to dispatch test chat alert" },
      { status: 500 },
    );
  }
}
