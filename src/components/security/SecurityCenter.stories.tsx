import type { Meta, StoryObj } from "@storybook/react";
import { SecurityCenter } from "./security-center";

/**
 * Security Center dashboard with comprehensive security overview.
 *
 * Features:
 * - Security score visualization (0-100) with color-coded ring
 * - Stat tiles for 2FA, passkeys, sessions, and recent events
 * - MFA verification status indicator
 * - Unverified email alert banner
 * - Sessions management card
 * - Activity feed card
 * - TOTP, Passkeys, Backup Codes, and Email Verification cards
 * - Responsive grid layout (3+2 columns on desktop)
 */
const meta: Meta<typeof SecurityCenter> = {
  title: "Security/SecurityCenter",
  component: SecurityCenter,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Comprehensive security dashboard showing security score, 2FA status, passkeys, sessions, and activity. Uses computeSecurityScore for real-time scoring.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SecurityCenter>;

/** Full security center with all sections */
export const Default: Story = {};

/** With dark theme context */
export const DarkTheme: Story = {
  parameters: {
    backgrounds: { default: "dark" },
    themes: { dark: true },
  },
};
