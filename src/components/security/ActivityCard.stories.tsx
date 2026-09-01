import type { Meta, StoryObj } from "@storybook/react";
import { ActivityCard } from "./activity-card";
import type { SecurityData } from "./use-security-data";

/**
 * Security activity card showing recent security events.
 *
 * Features:
 * - Lists security events from the last 7 days
 * - Color-coded event icons (login, logout, 2FA, passkeys, etc.)
 * - Suspicious activity detection with warning banner
 * - IP address and relative time for each event
 * - Refresh button to reload events
 * - Empty state when no recent events
 * - "No suspicious activity" green banner when all events are normal
 */
const meta: Meta<typeof ActivityCard> = {
  title: "Security/ActivityCard",
  component: ActivityCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Security activity card showing recent events like logins, 2FA changes, passkey updates, and suspicious activity detection.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ActivityCard>;

const createMockSecurityData = (overrides: Partial<SecurityData> = {}): SecurityData => ({
  totpEnabled: true,
  passkeys: [],
  backupRemaining: 5,
  emailVerified: "2026-01-15T10:00:00Z",
  sessions: [],
  events: [],
  mfaVerifiedRecently: true,
  loading: false,
  refresh: async () => {},
  ...overrides,
});

const now = new Date().toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();

/** No recent events */
export const NoEvents: Story = {
  args: {
    data: createMockSecurityData({ events: [] }),
  },
};

/** Normal activity — no suspicious events */
export const NormalActivity: Story = {
  args: {
    data: createMockSecurityData({
      events: [
        { id: "evt_1", type: "LOGIN", ip: "192.168.1.100", createdAt: hoursAgo(1) },
        { id: "evt_2", type: "MFA_VERIFIED", ip: "192.168.1.100", createdAt: hoursAgo(1) },
        { id: "evt_3", type: "EMAIL_VERIFIED", ip: "192.168.1.100", createdAt: daysAgo(2) },
        { id: "evt_4", type: "TOTP_ENABLED", ip: "192.168.1.100", createdAt: daysAgo(3) },
        { id: "evt_5", type: "BACKUP_CODES_GENERATED", ip: "192.168.1.100", createdAt: daysAgo(3) },
      ],
    }),
  },
};

/** Suspicious activity detected — shows warning */
export const SuspiciousActivity: Story = {
  args: {
    data: createMockSecurityData({
      events: [
        { id: "evt_1", type: "LOGIN", ip: "192.168.1.100", createdAt: hoursAgo(2) },
        { id: "evt_2", type: "LOGIN_FAILED", ip: "203.0.113.42", createdAt: hoursAgo(3) },
        { id: "evt_3", type: "LOGIN_FAILED", ip: "203.0.113.42", createdAt: hoursAgo(3) },
        { id: "evt_4", type: "ACCOUNT_LOCKED", ip: "203.0.113.42", createdAt: hoursAgo(3) },
        { id: "evt_5", type: "LOGIN", ip: "192.168.1.100", createdAt: hoursAgo(1) },
      ],
    }),
  },
};

/** Mixed activity with passkey and session events */
export const MixedEvents: Story = {
  args: {
    data: createMockSecurityData({
      events: [
        { id: "evt_1", type: "LOGIN", ip: "192.168.1.100", createdAt: hoursAgo(0.5) },
        { id: "evt_2", type: "PASSKEY_ADDED", ip: "192.168.1.100", createdAt: hoursAgo(4) },
        { id: "evt_3", type: "PASSKEY_LOGIN", ip: "10.0.0.55", createdAt: daysAgo(1) },
        { id: "evt_4", type: "SESSION_REVOKED", ip: "192.168.1.100", createdAt: daysAgo(2) },
        { id: "evt_5", type: "PASSWORD_CHANGE", ip: "192.168.1.100", createdAt: daysAgo(5) },
        { id: "evt_6", type: "LOGOUT", ip: "192.168.1.100", createdAt: daysAgo(6) },
      ],
    }),
  },
};
