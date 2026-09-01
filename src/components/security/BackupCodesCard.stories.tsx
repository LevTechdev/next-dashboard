import type { Meta, StoryObj } from "@storybook/react";
import { BackupCodesCard } from "./backup-codes-card";
import type { SecurityData } from "./use-security-data";

/**
 * Backup codes card for emergency 2FA recovery.
 *
 * Features:
 * - Shows remaining backup code count
 * - Generate new codes with confirmation dialog
 * - Copy codes to clipboard
 * - Download codes as text file
 * - Warning when codes are regenerated (invalidates old codes)
 */
const meta: Meta<typeof BackupCodesCard> = {
  title: "Security/BackupCodesCard",
  component: BackupCodesCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Backup codes card for emergency 2FA recovery. Users can generate, copy, and download single-use backup codes.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof BackupCodesCard>;

const createMockSecurityData = (overrides: Partial<SecurityData> = {}): SecurityData => ({
  totpEnabled: true,
  passkeys: [],
  backupRemaining: 0,
  emailVerified: "2026-01-15T10:00:00Z",
  sessions: [],
  events: [],
  mfaVerifiedRecently: true,
  loading: false,
  refresh: async () => {},
  ...overrides,
});

/** No backup codes generated yet — shows Generate button */
export const NoCodes: Story = {
  args: {
    data: createMockSecurityData({ backupRemaining: 0 }),
  },
};

/** Has backup codes remaining */
export const CodesRemaining: Story = {
  args: {
    data: createMockSecurityData({ backupRemaining: 7 }),
  },
};

/** Only 2 codes left — low count warning */
export const LowCount: Story = {
  args: {
    data: createMockSecurityData({ backupRemaining: 2 }),
  },
};

/** Loading state while fetching backup code count */
export const Loading: Story = {
  args: {
    data: createMockSecurityData({ backupRemaining: null, loading: true }),
  },
};
