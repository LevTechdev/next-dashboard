/**
 * Team Chat Alert Hub: Slack & Discord Payload Builders and Webhook Dispatcher
 */

export type ChatPlatform = "slack" | "discord";

export type ChatAlertType = "stockout" | "vip_order" | "payment_failed" | "daily_digest";

export interface StockoutAlertData {
  productName: string;
  sku: string;
  currentStock: number;
  salesVelocity: number; // units/day
  daysOfInventory: number;
  leadTimeDays: number;
  reorderPoint: number;
  suggestedQty: number;
  supplierName: string;
  actionUrl?: string;
}

export interface VipOrderAlertData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  itemsCount: number;
  channel: string;
  actionUrl?: string;
}

export interface PaymentFailedAlertData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  gateway: string;
  failureReason: string;
  actionUrl?: string;
}

export interface DailyDigestAlertData {
  dateStr: string;
  yesterdayGmv: number;
  ordersCount: number;
  avgOrderValue: number;
  newCustomersCount: number;
  lowStockItemsCount: number;
  topProductName: string;
}

export type AlertPayloadData =
  | { type: "stockout"; data: StockoutAlertData }
  | { type: "vip_order"; data: VipOrderAlertData }
  | { type: "payment_failed"; data: PaymentFailedAlertData }
  | { type: "daily_digest"; data: DailyDigestAlertData };

/**
 * Builds Slack Block Kit payload
 */
export function buildSlackPayload(payload: AlertPayloadData): Record<string, unknown> {
  const { type, data } = payload;

  if (type === "stockout") {
    const d = data as StockoutAlertData;
    return {
      text: `🚨 CRITICAL STOCKOUT ALERT: ${d.productName} (DOI: ${d.daysOfInventory} days)`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🚨 Critical Inventory Stockout Warning",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Product:* \`${d.sku}\` — *${d.productName}*\nCurrent stock will deplete in *${d.daysOfInventory} days* based on a velocity of *${d.salesVelocity} units/day*.`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Current Stock:*\n${d.currentStock} units` },
            {
              type: "mrkdwn",
              text: `*Supplier Lead Time:*\n${d.leadTimeDays} days (${d.supplierName})`,
            },
            { type: "mrkdwn", text: `*Reorder Point:*\n${d.reorderPoint} units` },
            { type: "mrkdwn", text: `*Suggested Restock:*\n*${d.suggestedQty} units*` },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "⚡ Generate Purchase Order", emoji: true },
              style: "danger",
              url: d.actionUrl || "http://localhost:3010/inventory",
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `LevTech Inventory Engine • Trigger DOI ≤ 7 days • ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };
  }

  if (type === "vip_order") {
    const d = data as VipOrderAlertData;
    return {
      text: `🎉 HIGH-VALUE VIP ORDER: #${d.orderNumber} ($${d.totalAmount.toLocaleString()})`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "💎 High-Value VIP Order Received",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `A new VIP purchase of *$${d.totalAmount.toLocaleString()}* was placed via *${d.channel}*.`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Order Number:*\n\`#${d.orderNumber}\`` },
            {
              type: "mrkdwn",
              text: `*Customer:*\n${d.customerName} (<mailto:${d.customerEmail}|${d.customerEmail}>)`,
            },
            { type: "mrkdwn", text: `*Items Count:*\n${d.itemsCount} products` },
            { type: "mrkdwn", text: `*Total Paid:*\n*$${d.totalAmount.toLocaleString()}*` },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "📦 View & Fulfill Order", emoji: true },
              style: "primary",
              url: d.actionUrl || "http://localhost:3010/orders",
            },
          ],
        },
      ],
    };
  }

  if (type === "payment_failed") {
    const d = data as PaymentFailedAlertData;
    return {
      text: `⚠️ PAYMENT SETTLEMENT ISSUE: #${d.orderNumber} ($${d.amount})`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "⚠️ Payment Settlement Alert",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `A transaction of *$${d.amount}* on gateway *${d.gateway.toUpperCase()}* failed settlement.\n*Reason:* _${d.failureReason}_`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Order:*\n\`#${d.orderNumber}\`` },
            { type: "mrkdwn", text: `*Customer:*\n${d.customerName}` },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "🔄 Retry Gateway Webhook", emoji: true },
              url: d.actionUrl || "http://localhost:3010/integrations",
            },
          ],
        },
      ],
    };
  }

  // daily_digest
  const d = data as DailyDigestAlertData;
  return {
    text: `📊 09:00 EXECUTIVE BRIEFING: $${d.yesterdayGmv.toLocaleString()} GMV (${d.ordersCount} orders)`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "☕ Daily 09:00 Executive Commerce Briefing",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Good morning! Here is yesterday's performance overview for *${d.dateStr}*:`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Gross Merchandise Value:*\n*$${d.yesterdayGmv.toLocaleString()}*`,
          },
          { type: "mrkdwn", text: `*Orders Completed:*\n*${d.ordersCount} orders*` },
          { type: "mrkdwn", text: `*Average Order Value:*\n*$${d.avgOrderValue}*` },
          { type: "mrkdwn", text: `*New Customers:*\n*+${d.newCustomersCount} buyers*` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `⭐ *Top Product:* ${d.topProductName}\n⚠️ *Low-Stock SKU Attention Required:* ${d.lowStockItemsCount} items`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "📈 Open Executive Analytics", emoji: true },
            style: "primary",
            url: "http://localhost:3010/analytics",
          },
        ],
      },
    ],
  };
}

/**
 * Builds Discord Embeds payload
 */
export function buildDiscordPayload(payload: AlertPayloadData): Record<string, unknown> {
  const { type, data } = payload;

  if (type === "stockout") {
    const d = data as StockoutAlertData;
    return {
      username: "LevTech Ops Bot",
      avatar_url: "https://next-dashboard-demo.vercel.app/logo.png",
      content: `🚨 **CRITICAL INVENTORY ALERT**: \`${d.sku}\` stock is dangerously low!`,
      embeds: [
        {
          title: "🚨 Critical Stockout Warning",
          description: `**${d.productName}** has only **${d.daysOfInventory} days of inventory** left at current sales velocity (**${d.salesVelocity} units/day**).`,
          color: 0xef4444, // Red
          fields: [
            { name: "Current Stock", value: `${d.currentStock} units`, inline: true },
            { name: "Supplier Lead Time", value: `${d.leadTimeDays} days`, inline: true },
            { name: "Reorder Point", value: `${d.reorderPoint} units`, inline: true },
            { name: "Recommended PO Qty", value: `**${d.suggestedQty} units**`, inline: true },
            { name: "Verified Vendor", value: d.supplierName, inline: true },
          ],
          footer: { text: "LevTech Supply Chain • 1-Click PO Engine" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  if (type === "vip_order") {
    const d = data as VipOrderAlertData;
    return {
      username: "LevTech Revenue Radar",
      content: `🎉 **High-Value VIP Order Received!**`,
      embeds: [
        {
          title: "💎 VIP Purchase Alert",
          description: `Order **#${d.orderNumber}** generated **$${d.totalAmount.toLocaleString()}** via **${d.channel}**.`,
          color: 0x10b981, // Emerald
          fields: [
            { name: "Customer", value: `${d.customerName} (${d.customerEmail})`, inline: true },
            { name: "Order Total", value: `**$${d.totalAmount.toLocaleString()}**`, inline: true },
            { name: "Total Items", value: `${d.itemsCount} units`, inline: true },
            { name: "Channel", value: d.channel, inline: true },
          ],
          footer: { text: "LevTech Real-Time Radar" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  if (type === "payment_failed") {
    const d = data as PaymentFailedAlertData;
    return {
      username: "LevTech Finance Watch",
      content: `⚠️ **Payment Settlement Alert**`,
      embeds: [
        {
          title: "⚠️ Gateway Payment Issue",
          description: `Payment for order **#${d.orderNumber}** ($${d.amount}) failed on **${d.gateway.toUpperCase()}**.`,
          color: 0xf59e0b, // Amber
          fields: [
            { name: "Customer", value: d.customerName, inline: true },
            { name: "Amount Due", value: `$${d.amount}`, inline: true },
            { name: "Error Code / Reason", value: d.failureReason, inline: false },
          ],
          footer: { text: "LevTech Automated Recovery" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  // daily_digest
  const d = data as DailyDigestAlertData;
  return {
    username: "LevTech Morning Standup",
    content: `☕ **Daily 09:00 Executive Commerce Briefing**`,
    embeds: [
      {
        title: `Commerce Snapshot — ${d.dateStr}`,
        description: `Yesterday's cross-channel sales and logistics recap:`,
        color: 0x6366f1, // Indigo
        fields: [
          {
            name: "Gross Merchandise Value",
            value: `**$${d.yesterdayGmv.toLocaleString()}**`,
            inline: true,
          },
          { name: "Orders Fulfilled", value: `**${d.ordersCount}**`, inline: true },
          { name: "Average Order Value", value: `$${d.avgOrderValue}`, inline: true },
          { name: "New Customers", value: `+${d.newCustomersCount}`, inline: true },
          { name: "Top-Performing Item", value: d.topProductName, inline: true },
          { name: "Low-Stock SKU Alerts", value: `${d.lowStockItemsCount} items`, inline: true },
        ],
        footer: { text: "LevTech Executive Telemetry" },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Dispatches an outgoing webhook to Slack or Discord.
 * Supports live HTTPS delivery with timeout, or local test simulation.
 */
export async function dispatchWebhook(
  url: string,
  platform: ChatPlatform,
  payload: Record<string, unknown>,
): Promise<{
  success: boolean;
  statusCode: number;
  durationMs: number;
  responseText: string;
  error?: string;
}> {
  const startTime = Date.now();

  // If local simulation or mock URL
  if (
    !url ||
    url.startsWith("mock://") ||
    url.includes("example.com") ||
    url.includes("localhost") ||
    url.startsWith("simulation://")
  ) {
    const simulatedLatency = Math.floor(80 + Math.random() * 120);
    return {
      success: true,
      statusCode: 200,
      durationMs: simulatedLatency,
      responseText: `[SIMULATION OK] Payload successfully accepted by ${platform} endpoint simulator.`,
    };
  }

  // Real HTTPS delivery
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const text = await res.text().catch(() => "");

    return {
      success: res.ok,
      statusCode: res.status,
      durationMs,
      responseText: text || (res.ok ? "ok" : `HTTP ${res.status}`),
      error: res.ok ? undefined : `HTTP error status ${res.status}: ${text.slice(0, 100)}`,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      statusCode: 500,
      durationMs,
      responseText: err.message || "Network error",
      error: err.message || "Failed to dispatch webhook",
    };
  }
}
