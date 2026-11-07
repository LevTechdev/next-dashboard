import { prisma } from "@/lib/db";
import { ChatPlatform, ChatAlertType } from "./chat-alerts";

export interface ChatChannelConfig {
  id: string;
  name: string;
  platform: ChatPlatform;
  webhookUrl: string;
  channelName: string; // e.g. "#ops-alerts" or "Discord Server / #general"
  avatarUrl?: string;
  enabledEvents: ChatAlertType[];
  status: "ACTIVE" | "PAUSED";
  lastPingAt?: string | null;
  lastStatus?: "SUCCESS" | "FAILED" | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAlertTriggerRules {
  stockoutDoiThreshold: number; // days (default 7)
  vipOrderMinAmount: number; // USD (default 500)
  paymentAlertsEnabled: boolean; // default true
  dailyDigestTime: string; // default "09:00"
  dailyDigestEnabled: boolean; // default true
}

export interface ChatDeliveryLog {
  id: string;
  channelId: string;
  platform: ChatPlatform;
  event: ChatAlertType;
  status: "DELIVERED" | "FAILED" | "SIMULATED";
  statusCode: number;
  durationMs: number;
  payloadPreview: string;
  responseText?: string;
  createdAt: string;
}

export interface ChatAlertsData {
  channels: ChatChannelConfig[];
  rules: ChatAlertTriggerRules;
  deliveries: ChatDeliveryLog[];
}

const DEFAULT_RULES: ChatAlertTriggerRules = {
  stockoutDoiThreshold: 7,
  vipOrderMinAmount: 500,
  paymentAlertsEnabled: true,
  dailyDigestTime: "09:00",
  dailyDigestEnabled: true,
};

const DEFAULT_CHANNELS: Array<
  Omit<ChatChannelConfig, "id" | "createdAt" | "updatedAt" | "lastPingAt" | "lastStatus"> & {
    id: string;
  }
> = [
  {
    id: "chan-slack-1",
    name: "Slack Operations & Logistics",
    platform: "slack",
    webhookUrl: "mock://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
    channelName: "#logistics-alerts",
    enabledEvents: ["stockout", "vip_order", "daily_digest"],
    status: "ACTIVE",
  },
  {
    id: "chan-discord-1",
    name: "Discord Finance & Growth",
    platform: "discord",
    webhookUrl: "mock://discord.com/api/webhooks/000000000000000000/mock-token-discord",
    channelName: "LevTech HQ / #finance-radar",
    avatarUrl: "https://next-dashboard-demo.vercel.app/logo.png",
    enabledEvents: ["vip_order", "payment_failed"],
    status: "ACTIVE",
  },
];

const DEFAULT_DELIVERIES: Array<Omit<ChatDeliveryLog, "createdAt">> = [
  {
    id: "deliv-seed-1",
    channelId: "chan-slack-1",
    platform: "slack",
    event: "stockout",
    status: "SIMULATED",
    statusCode: 200,
    durationMs: 94,
    payloadPreview: "🚨 Critical Inventory Stockout: SHIRT-OXF-001 (DOI: 4 days)",
    responseText: "ok",
  },
  {
    id: "deliv-seed-2",
    channelId: "chan-discord-1",
    platform: "discord",
    event: "vip_order",
    status: "SIMULATED",
    statusCode: 200,
    durationMs: 112,
    payloadPreview: "💎 VIP Purchase: Order #ORD-2026-9842 ($1,450.00)",
    responseText: "ok",
  },
];

function mapChannel(row: {
  id: string;
  name: string;
  platform: string;
  webhookUrl: string;
  channelName: string;
  avatarUrl: string | null;
  enabledEvents: string[];
  status: string;
  lastPingAt: Date | null;
  lastStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ChatChannelConfig {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform as ChatPlatform,
    webhookUrl: row.webhookUrl,
    channelName: row.channelName,
    avatarUrl: row.avatarUrl ?? undefined,
    enabledEvents: row.enabledEvents as ChatAlertType[],
    status: row.status === "PAUSED" ? "PAUSED" : "ACTIVE",
    lastPingAt: row.lastPingAt?.toISOString() ?? null,
    lastStatus: row.lastStatus === "FAILED" ? "FAILED" : row.lastStatus ? "SUCCESS" : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapDelivery(row: {
  id: string;
  channelId: string;
  platform: string;
  event: string;
  status: string;
  statusCode: number;
  durationMs: number;
  payloadPreview: string;
  responseText: string | null;
  createdAt: Date;
}): ChatDeliveryLog {
  return {
    id: row.id,
    channelId: row.channelId,
    platform: row.platform as ChatPlatform,
    event: row.event as ChatAlertType,
    status: row.status as ChatDeliveryLog["status"],
    statusCode: row.statusCode,
    durationMs: row.durationMs,
    payloadPreview: row.payloadPreview,
    responseText: row.responseText ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Seed the demo channels/deliveries once per workspace so the hub is not blank. */
async function ensureConfig(tenantId: string) {
  const [channelCount, rules, deliveryCount] = await Promise.all([
    prisma.chatChannel.count({ where: { tenantId } }),
    prisma.chatAlertRule.findUnique({ where: { tenantId } }),
    prisma.chatDeliveryLog.count({ where: { tenantId } }),
  ]);

  const now = new Date();
  if (channelCount === 0) {
    await prisma.chatChannel.createMany({
      data: DEFAULT_CHANNELS.map((channel, index) => ({
        ...channel,
        tenantId,
        lastPingAt: new Date(now.getTime() - 3_600_000 * (index === 0 ? 4 : 8)),
        lastStatus: "SUCCESS",
        createdAt: new Date(now.getTime() - 86_400_000 * (index === 0 ? 14 : 10)),
        updatedAt: new Date(now.getTime() - 3_600_000 * (index === 0 ? 4 : 8)),
      })),
      skipDuplicates: true,
    });
  }

  if (!rules) {
    await prisma.chatAlertRule.create({
      data: { tenantId, ...DEFAULT_RULES },
    });
  }

  if (deliveryCount === 0) {
    await prisma.chatDeliveryLog.createMany({
      data: DEFAULT_DELIVERIES.map((delivery, index) => ({
        ...delivery,
        tenantId,
        createdAt: new Date(now.getTime() - 3_600_000 * (index === 0 ? 4 : 8)),
      })),
      skipDuplicates: true,
    });
  }
}

export async function getChatConfig(tenantId: string): Promise<ChatAlertsData> {
  await ensureConfig(tenantId);

  const [channels, rules, deliveries] = await Promise.all([
    prisma.chatChannel.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.chatAlertRule.findUnique({ where: { tenantId } }),
    prisma.chatDeliveryLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return {
    channels: channels.map(mapChannel),
    rules: rules
      ? {
          stockoutDoiThreshold: rules.stockoutDoiThreshold,
          vipOrderMinAmount: rules.vipOrderMinAmount,
          paymentAlertsEnabled: rules.paymentAlertsEnabled,
          dailyDigestTime: rules.dailyDigestTime,
          dailyDigestEnabled: rules.dailyDigestEnabled,
        }
      : DEFAULT_RULES,
    deliveries: deliveries.map(mapDelivery),
  };
}

export async function upsertChatChannel(
  tenantId: string,
  channel: Omit<ChatChannelConfig, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<ChatChannelConfig> {
  const now = new Date();

  if (channel.id) {
    const existing = await prisma.chatChannel.findFirst({
      where: { id: channel.id, tenantId },
    });
    if (existing) {
      const updated = await prisma.chatChannel.update({
        where: { id: existing.id },
        data: {
          name: channel.name,
          platform: channel.platform,
          webhookUrl: channel.webhookUrl,
          channelName: channel.channelName,
          avatarUrl: channel.avatarUrl,
          enabledEvents: channel.enabledEvents,
          status: channel.status || "ACTIVE",
          updatedAt: now,
        },
      });
      return mapChannel(updated);
    }
  }

  const created = await prisma.chatChannel.create({
    data: {
      id: `chan-${channel.platform}-${Date.now()}`,
      tenantId,
      name: channel.name,
      platform: channel.platform,
      webhookUrl: channel.webhookUrl,
      channelName: channel.channelName,
      avatarUrl: channel.avatarUrl,
      enabledEvents: channel.enabledEvents,
      status: channel.status || "ACTIVE",
      createdAt: now,
      updatedAt: now,
    },
  });
  return mapChannel(created);
}

export async function deleteChatChannel(tenantId: string, id: string): Promise<boolean> {
  const result = await prisma.chatChannel.deleteMany({ where: { id, tenantId } });
  return result.count > 0;
}

export async function updateChatRules(
  tenantId: string,
  rules: Partial<ChatAlertTriggerRules>,
): Promise<ChatAlertTriggerRules> {
  const current = await prisma.chatAlertRule.findUnique({ where: { tenantId } });
  const merged: ChatAlertTriggerRules = {
    ...DEFAULT_RULES,
    ...(current
      ? {
          stockoutDoiThreshold: current.stockoutDoiThreshold,
          vipOrderMinAmount: current.vipOrderMinAmount,
          paymentAlertsEnabled: current.paymentAlertsEnabled,
          dailyDigestTime: current.dailyDigestTime,
          dailyDigestEnabled: current.dailyDigestEnabled,
        }
      : {}),
    ...rules,
  };

  await prisma.chatAlertRule.upsert({
    where: { tenantId },
    create: { tenantId, ...merged },
    update: merged,
  });

  return merged;
}

export async function logDelivery(
  tenantId: string,
  log: Omit<ChatDeliveryLog, "id" | "createdAt">,
): Promise<ChatDeliveryLog> {
  const now = new Date();
  const created = await prisma.chatDeliveryLog.create({
    data: {
      id: `deliv-${Date.now()}`,
      tenantId,
      channelId: log.channelId,
      platform: log.platform,
      event: log.event,
      status: log.status,
      statusCode: log.statusCode,
      durationMs: log.durationMs,
      payloadPreview: log.payloadPreview,
      responseText: log.responseText,
      createdAt: now,
    },
  });

  await prisma.chatChannel.updateMany({
    where: { id: log.channelId, tenantId },
    data: {
      lastPingAt: now,
      lastStatus: log.status === "FAILED" ? "FAILED" : "SUCCESS",
      updatedAt: now,
    },
  });

  // Keep the delivery trail bounded per workspace.
  const overflow = await prisma.chatDeliveryLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    skip: 25,
    select: { id: true },
  });
  if (overflow.length > 0) {
    await prisma.chatDeliveryLog.deleteMany({
      where: { id: { in: overflow.map((row) => row.id) } },
    });
  }

  return mapDelivery(created);
}
