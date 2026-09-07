import fs from "fs";
import path from "path";
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

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "chat-alerts.json");

const DEFAULT_CHANNELS: ChatChannelConfig[] = [
  {
    id: "chan-slack-1",
    name: "Slack Operations & Logistics",
    platform: "slack",
    webhookUrl: "mock://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
    channelName: "#logistics-alerts",
    enabledEvents: ["stockout", "vip_order", "daily_digest"],
    status: "ACTIVE",
    lastPingAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    lastStatus: "SUCCESS",
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
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
    lastPingAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    lastStatus: "SUCCESS",
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
];

const DEFAULT_RULES: ChatAlertTriggerRules = {
  stockoutDoiThreshold: 7,
  vipOrderMinAmount: 500,
  paymentAlertsEnabled: true,
  dailyDigestTime: "09:00",
  dailyDigestEnabled: true,
};

const DEFAULT_DELIVERIES: ChatDeliveryLog[] = [
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
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
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
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
];

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getChatConfig(): ChatAlertsData {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    const initialData: ChatAlertsData = {
      channels: DEFAULT_CHANNELS,
      rules: DEFAULT_RULES,
      deliveries: DEFAULT_DELIVERIES,
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(initialData, null, 2), "utf-8");
    return initialData;
  }

  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      channels: Array.isArray(parsed.channels) ? parsed.channels : DEFAULT_CHANNELS,
      rules: { ...DEFAULT_RULES, ...(parsed.rules || {}) },
      deliveries: Array.isArray(parsed.deliveries) ? parsed.deliveries : DEFAULT_DELIVERIES,
    };
  } catch {
    return {
      channels: DEFAULT_CHANNELS,
      rules: DEFAULT_RULES,
      deliveries: DEFAULT_DELIVERIES,
    };
  }
}

export function saveChatConfig(data: ChatAlertsData): void {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function upsertChatChannel(
  channel: Omit<ChatChannelConfig, "id" | "createdAt" | "updatedAt"> & { id?: string },
): ChatChannelConfig {
  const current = getChatConfig();
  const now = new Date().toISOString();

  if (channel.id) {
    const idx = current.channels.findIndex((c) => c.id === channel.id);
    if (idx >= 0) {
      const updated: ChatChannelConfig = {
        ...current.channels[idx],
        ...channel,
        id: channel.id,
        updatedAt: now,
      };
      current.channels[idx] = updated;
      saveChatConfig(current);
      return updated;
    }
  }

  const newChannel: ChatChannelConfig = {
    id: `chan-${channel.platform}-${Date.now()}`,
    name: channel.name,
    platform: channel.platform,
    webhookUrl: channel.webhookUrl,
    channelName: channel.channelName,
    avatarUrl: channel.avatarUrl,
    enabledEvents: channel.enabledEvents,
    status: channel.status || "ACTIVE",
    lastPingAt: null,
    lastStatus: null,
    createdAt: now,
    updatedAt: now,
  };

  current.channels.push(newChannel);
  saveChatConfig(current);
  return newChannel;
}

export function deleteChatChannel(id: string): boolean {
  const current = getChatConfig();
  const initialLen = current.channels.length;
  current.channels = current.channels.filter((c) => c.id !== id);
  if (current.channels.length !== initialLen) {
    saveChatConfig(current);
    return true;
  }
  return false;
}

export function updateChatRules(rules: Partial<ChatAlertTriggerRules>): ChatAlertTriggerRules {
  const current = getChatConfig();
  current.rules = { ...current.rules, ...rules };
  saveChatConfig(current);
  return current.rules;
}

export function logDelivery(log: Omit<ChatDeliveryLog, "id" | "createdAt">): ChatDeliveryLog {
  const current = getChatConfig();
  const newLog: ChatDeliveryLog = {
    id: `deliv-${Date.now()}`,
    ...log,
    createdAt: new Date().toISOString(),
  };

  // Keep latest 25 deliveries
  current.deliveries = [newLog, ...current.deliveries].slice(0, 25);

  // Update channel status
  const chan = current.channels.find((c) => c.id === log.channelId);
  if (chan) {
    chan.lastPingAt = newLog.createdAt;
    chan.lastStatus = log.status === "FAILED" ? "FAILED" : "SUCCESS";
    chan.updatedAt = newLog.createdAt;
  }

  saveChatConfig(current);
  return newLog;
}
