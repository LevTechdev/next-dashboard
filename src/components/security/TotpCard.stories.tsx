import type { Meta, StoryObj } from "@storybook/react";
import { TotpCard } from "./totp-card";
import type { SecurityData } from "./use-security-data";

/**
 * TOTP (Time-based One-Time Password) card for two-factor authentication setup.
 *
 * Features:
 * - Toggle 2FA on/off with switch
 * - QR code display for authenticator app setup
 * - Manual secret key entry with copy functionality
 * - 6-digit verification code input
 * - Disable 2FA with password confirmation
 * - Visual status indicators (enabled/disabled/verified)
 */
const meta: Meta<typeof TotpCard> = {
  title: "Security/TotpCard",
  component: TotpCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Two-factor authentication card using TOTP protocol. Supports setup via QR code, manual entry, and verification with 6-digit codes.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TotpCard>;

const createMockSecurityData = (overrides: Partial<SecurityData> = {}): SecurityData => ({
  totpEnabled: false,
  passkeys: [],
  backupRemaining: 0,
  emailVerified: null,
  sessions: [],
  events: [],
  mfaVerifiedRecently: false,
  loading: false,
  refresh: async () => {},
  ...overrides,
});

/** 2FA disabled - shows setup prompt */
export const Disabled: Story = {
  args: {
    data: createMockSecurityData({ totpEnabled: false }),
  },
};

/** 2FA enabled - shows active status */
export const Enabled: Story = {
  args: {
    data: createMockSecurityData({ totpEnabled: true }),
  },
};

/** Loading state */
export const Loading: Story = {
  args: {
    data: createMockSecurityData({ loading: true }),
  },
};
