import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { SparklesIcon, SunIcon } from "lucide-animated";

/**
 * Premium button system with 8 variants, 5 sizes, and design token integration.
 *
 * **Design Tokens Used:**
 * - `--glow-indigo` — Premium variant gradient start
 * - `--gradient-premium` — Premium variant background
 * - `--glass-bg` / `--glass-border` — Glass variant transparency
 * - `--border` / `--input` — Outline/ghost variant borders
 */
const meta: Meta<typeof Button> = {
  title: "Design System/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
        "premium",
        "glass",
      ],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "xl", "icon"],
    },
    disabled: { control: "boolean" },
  },
  args: {
    children: "Button",
    variant: "default",
    size: "default",
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ── Variants ───────────────────────────────────────────────────────

export const Default: Story = {
  args: { variant: "default" },
  parameters: {
    docs: {
      description: {
        story: "Standard indigo action button. Uses `bg-indigo-600` → `dark:bg-indigo-500`.",
      },
    },
  },
};

export const Secondary: Story = {
  args: { variant: "secondary" },
  parameters: {
    docs: { description: { story: "Low-emphasis gray button for secondary actions." } },
  },
};

export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete" },
  parameters: {
    docs: {
      description: { story: "Red destructive action. Uses `--destructive` token for hover." },
    },
  },
};

export const Outline: Story = {
  args: { variant: "outline" },
  parameters: {
    docs: {
      description: { story: "Bordered button for paired actions. Border uses `--border` token." },
    },
  },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
  parameters: {
    docs: { description: { story: "Minimal transparent button for toolbars and icon actions." } },
  },
};

export const Link: Story = {
  args: { variant: "link" },
  parameters: {
    docs: {
      description: { story: "Text-link style button. Use for inline actions and navigation." },
    },
  },
};

export const Premium: Story = {
  args: { variant: "premium", children: "Premium", className: "gap-1.5" },
  parameters: {
    docs: {
      description: {
        story:
          "Gradient CTA button. Uses `--gradient-premium` token. Light mode: `#6366f1 → #a855f7 → #ec4899`. Dark mode: `#818cf8 → #c084fc → #f472b6`.",
      },
    },
  },
  render: (args) => (
    <Button {...args}>
      <SparklesIcon size={16} className="h-4 w-4" />
      {args.children}
    </Button>
  ),
};

export const Glass: Story = {
  args: { variant: "glass" },
  parameters: {
    docs: {
      description: {
        story:
          "Frosted glass button with backdrop blur. Uses `--glass-bg` and `--glass-border` tokens.",
      },
    },
  },
};

// ── Sizes ──────────────────────────────────────────────────────────

export const Sizes: Story = {
  parameters: {
    docs: {
      description: { story: "All 5 button sizes: `sm`, `default`, `lg`, `xl`, and `icon`." },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small (h-9)</Button>
      <Button size="default">Default (h-10)</Button>
      <Button size="lg">Large (h-11)</Button>
      <Button size="xl">XL (h-12)</Button>
      <Button size="icon">
        <SunIcon size={16} className="h-4 w-4" />
      </Button>
    </div>
  ),
};

// ── All Variants Grid ──────────────────────────────────────────────

export const AllVariants: Story = {
  parameters: {
    docs: {
      description: { story: "Complete grid of all 8 button variants for visual comparison." },
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      <Button variant="premium" className="gap-1.5">
        <SparklesIcon size={16} className="h-4 w-4" />
        Premium
      </Button>
      <Button variant="glass">Glass</Button>
    </div>
  ),
};

// ─── Example: Theme-aware CTA ─────────────────────────────────────

export const PremiumCTA: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Full-width premium CTA with icon. The gradient automatically adapts between light (`#6366f1 → #a855f7 → #ec4899`) and dark (`#818cf8 → #c084fc → #f472b6`) modes.",
      },
    },
  },
  render: () => (
    <Button variant="premium" size="xl" className="gap-2 w-full max-w-xs">
      <SparklesIcon size={20} className="h-5 w-5" />
      Access Workspace
    </Button>
  ),
};
