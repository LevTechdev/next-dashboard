import type { Meta, StoryObj } from "@storybook/react";
import { EmailVerificationCard } from "./email-verification-card";
import type { SecurityData } from "./use-security-data";

/**
 * Email verification card with OTP input and verification link.
 *
 * Features:
 * - Send verification email with cooldown timer
 * - 6-digit OTP input with auto-submit on completion
 * - Dev mode fallback showing OTP code and verification URL
 * - Visual status (verified/unverified) with date
 * - Resend countdown timer
 * - Copy verification link functionality
 */
const meta: Meta<typeof EmailVerificationCard> = {
  title: "Security/EmailVerificationCard",
  component: EmailVerificationCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Email verification card supporting OTP-based verification with cooldown timer and dev mode fallback.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof EmailVerificationCard>;

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

/** Email not verified - shows verification form */
export const Unverified: Story = {
  args: {
    data: createMockSecurityData({ emailVerified: null }),
  },
};

/** Email verified - shows success status */
export const Verified: Story = {
  args: {
    data: createMockSecurityData({ emailVerified: "2024-01-15T10:30:00Z" }),
  },
};

/** Loading state */
export const Loading: Story = {
  args: {
    data: createMockSecurityData({ loading: true }),
  },
};
