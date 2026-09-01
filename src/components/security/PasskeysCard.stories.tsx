import type { Meta, StoryObj } from "@storybook/react";
import { PasskeysCard } from "./passkeys-card";
import type { SecurityData } from "./use-security-data";

/**
 * Passkeys card for passwordless authentication management.
 *
 * Features:
 * - List registered passkeys with device name and last used time
 * - Add new passkey via WebAuthn registration
 * - Revoke passkey with password re-verification (step-up auth)
 * - Verified badge for each passkey
 * - Warning when only one passkey remains
 * - Delete confirmation dialog with password input
 */
const meta: Meta<typeof PasskeysCard> = {
  title: "Security/PasskeysCard",
  component: PasskeysCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Passkeys card for passwordless authentication. Manages WebAuthn credentials with add/revoke flows and step-up verification.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PasskeysCard>;

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

/** No passkeys registered — shows Add Passkey button */
export const NoPasskeys: Story = {
  args: {
    data: createMockSecurityData({ passkeys: [] }),
  },
};

/** One passkey registered */
export const OnePasskey: Story = {
  args: {
    data: createMockSecurityData({
      passkeys: [
        {
          id: "pk_001",
          deviceName: "MacBook Pro",
          createdAt: "2026-08-20T14:30:00Z",
          lastUsedAt: "2026-08-31T08:15:00Z",
        },
      ],
    }),
  },
};

/** Multiple passkeys registered */
export const MultiplePasskeys: Story = {
  args: {
    data: createMockSecurityData({
      passkeys: [
        {
          id: "pk_001",
          deviceName: "MacBook Pro",
          createdAt: "2026-08-20T14:30:00Z",
          lastUsedAt: "2026-08-31T08:15:00Z",
        },
        {
          id: "pk_002",
          deviceName: "iPhone 15 Pro",
          createdAt: "2026-08-25T09:00:00Z",
          lastUsedAt: "2026-08-30T22:45:00Z",
        },
        {
          id: "pk_003",
          deviceName: "YubiKey 5",
          createdAt: "2026-07-10T11:20:00Z",
          lastUsedAt: null,
        },
      ],
    }),
  },
};

/** Passkey with no device name (shows default "Passkey" label) */
export const NoDeviceName: Story = {
  args: {
    data: createMockSecurityData({
      passkeys: [
        {
          id: "pk_004",
          deviceName: null,
          createdAt: "2026-08-28T16:00:00Z",
          lastUsedAt: "2026-08-31T10:00:00Z",
        },
      ],
    }),
  },
};
