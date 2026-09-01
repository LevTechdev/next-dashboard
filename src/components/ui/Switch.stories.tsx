import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./switch";

/**
 * Accessible toggle switch using Radix UI primitives.
 *
 * Features:
 * - Keyboard accessible (Space/Enter to toggle)
 * - Screen reader friendly with aria-label
 * - Theme-aware colors (green in light, purple in dark)
 * - Smooth animation on state change
 * - Disabled state support
 */
const meta: Meta<typeof Switch> = {
  title: "Design System/Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
    checked: { control: "boolean" },
  },
  args: {
    "aria-label": "Toggle feature",
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Unchecked: Story = {};

export const Checked: Story = {
  args: { checked: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const DisabledChecked: Story = {
  args: { disabled: true, checked: true },
};

/** Multiple switches with labels */
export const WithLabels: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch id="notifications" aria-label="Enable notifications" />
        <label htmlFor="notifications" className="text-sm font-medium">
          Enable notifications
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="darkmode" aria-label="Dark mode" defaultChecked />
        <label htmlFor="darkmode" className="text-sm font-medium">
          Dark mode
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="2fa" aria-label="Two-factor authentication" />
        <label htmlFor="2fa" className="text-sm font-medium">
          Two-factor authentication
        </label>
      </div>
    </div>
  ),
};
