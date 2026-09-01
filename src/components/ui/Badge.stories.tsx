import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

/**
 * Badge component with 6 variants for status indicators and labels.
 *
 * **Variants:**
 * - `default` - Indigo (primary actions)
 * - `success` - Green (completed/active)
 * - `warning` - Yellow (attention needed)
 * - `danger` - Red (errors/destructive)
 * - `info` - Blue (informational)
 * - `outline` - Border only (neutral)
 */
const meta: Meta<typeof Badge> = {
  title: "Design System/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "success", "warning", "danger", "info", "outline"],
    },
  },
  args: {
    children: "Badge",
    variant: "default",
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const Success: Story = {
  args: { variant: "success", children: "Active" },
};

export const Warning: Story = {
  args: { variant: "warning", children: "Pending" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Error" },
};

export const Info: Story = {
  args: { variant: "info", children: "Info" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "Tag" },
};

/** All variants displayed together for comparison */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="danger">Danger</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};
