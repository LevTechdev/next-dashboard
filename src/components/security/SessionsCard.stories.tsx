import type { Meta, StoryObj } from "@storybook/react";
import { SessionsCard } from "./sessions-card";
import type { SecurityData } from "./use-security-data";

/**
 * Active sessions card for session management.
 *
 * Features:
 * - List all active sessions with browser, device, IP, and location
 * - Current device badge highlight
 * - Revoke individual sessions
 * - Revoke all other sessions with confirmation
 * - Relative time display (e.g. "5m ago", "2h ago")
 * - Empty state when no sessions
 */
const meta: Meta<typeof SessionsCard> = {
  title: "Security/SessionsCard",
  component: SessionsCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Active sessions card for managing device sessions. Shows browser, device, IP, and allows revoking individual or all other sessions.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SessionsCard>;

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

/** No active sessions */
export const NoSessions: Story = {
  args: {
    data: createMockSecurityData({ sessions: [] }),
  },
};

/** Single current session only */
export const SingleSession: Story = {
  args: {
    data: createMockSecurityData({
      sessions: [
        {
          id: "sess_001",
          ip: "192.168.1.100",
          browser: "Chrome 128",
          device: "MacBook Pro",
          location: "San Francisco, US",
          lastActiveAt: new Date().toISOString(),
          createdAt: "2026-08-31T08:00:00Z",
          current: true,
        },
      ],
    }),
  },
};

/** Multiple sessions with current device */
export const MultipleSessions: Story = {
  args: {
    data: createMockSecurityData({
      sessions: [
        {
          id: "sess_001",
          ip: "192.168.1.100",
          browser: "Chrome 128",
          device: "MacBook Pro",
          location: "San Francisco, US",
          lastActiveAt: new Date().toISOString(),
          createdAt: "2026-08-31T08:00:00Z",
          current: true,
        },
        {
          id: "sess_002",
          ip: "10.0.0.55",
          browser: "Safari 19",
          device: "iPhone 15 Pro",
          location: "New York, US",
          lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          createdAt: "2026-08-30T14:30:00Z",
          current: false,
        },
        {
          id: "sess_003",
          ip: "172.16.0.10",
          browser: "Firefox 130",
          device: "Windows Desktop",
          location: "London, UK",
          lastActiveAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          createdAt: "2026-08-29T09:15:00Z",
          current: false,
        },
      ],
    }),
  },
};

/** Session with minimal info (unknown browser/device) */
export const MinimalInfo: Story = {
  args: {
    data: createMockSecurityData({
      sessions: [
        {
          id: "sess_004",
          ip: null,
          browser: null,
          device: null,
          location: null,
          lastActiveAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          createdAt: "2026-08-31T10:00:00Z",
          current: true,
        },
        {
          id: "sess_005",
          ip: "203.0.113.42",
          browser: "Unknown",
          device: "Unknown",
          location: null,
          lastActiveAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          createdAt: "2026-08-31T11:30:00Z",
          current: false,
        },
      ],
    }),
  },
};
