import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";

/**
 * Input component with consistent styling and focus states.
 *
 * Features:
 * - Light/dark theme support
 * - Focus ring with indigo color
 * - Disabled state with reduced opacity
 * - Placeholder text styling
 * - Password, email, and numeric types
 */
const meta: Meta<typeof Input> = {
  title: "Design System/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "password", "email", "number", "search", "tel", "url"],
    },
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
  },
  args: {
    placeholder: "Enter text...",
    type: "text",
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const Password: Story = {
  args: { type: "password", placeholder: "Enter password..." },
};

export const Email: Story = {
  args: { type: "email", placeholder: "user@example.com" },
};

export const WithValue: Story = {
  args: { value: "Hello, World!" },
};

export const Disabled: Story = {
  args: { disabled: true, value: "Disabled input" },
};

/** Different input types side by side */
export const InputTypes: Story = {
  render: () => (
    <div className="space-y-4 w-full max-w-sm">
      <Input type="text" placeholder="Text input" />
      <Input type="password" placeholder="Password input" />
      <Input type="email" placeholder="Email input" />
      <Input type="number" placeholder="Number input" />
      <Input type="search" placeholder="Search input" />
      <Input disabled placeholder="Disabled input" />
    </div>
  ),
};
