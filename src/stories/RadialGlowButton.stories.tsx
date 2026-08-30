import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { RadialGlowButton } from "@/components/ui/radial-glow-button";

const meta = {
  title: "UI/RadialGlowButton",
  component: RadialGlowButton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Premium radial-glow CTA button (Vengeance UI). Renders as a native " +
          "`<button>` by default, or as any single child element (e.g. a " +
          "`next/link` Link) when `asChild` is set — producing valid HTML " +
          "instead of a `<button>` nested inside an `<a>`.\n\n" +
          "The glow's animated shine (pan + conic sweep) is purely decorative " +
          "and is disabled for users who opt out of motion via " +
          "`prefers-reduced-motion: reduce`. Use the **Motion** toolbar global " +
          "to preview the reduced-motion state, which keeps the glow visible " +
          "but static.",
      },
    },
  },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["default", "sm"],
      table: { defaultValue: { summary: "default" } },
    },
    asChild: { control: "boolean" },
    children: { control: "text" },
    className: { control: "text" },
    wrapperClassName: { control: "text" },
  },
  args: {
    children: "Get Extension",
  },
} satisfies Meta<typeof RadialGlowButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default full-size CTA button. */
export const Default: Story = {};

/** Compact variant for navigation bars and small CTAs. */
export const Small: Story = {
  args: {
    size: "sm",
    children: "Sign in",
  },
};

/**
 * `asChild` renders the child element (here a `next/link` Link) as the button
 * itself — valid HTML (`<a class="rg-button">`) instead of a `<button>` inside
 * an `<a>`. Right-click the link to confirm it is a real anchor. (Note: the
 * Storybook `next/link` mock intercepts clicks, so the link won't navigate
 * inside the canvas.)
 */
export const AsChildLink: Story = {
  render: (args) => (
    <RadialGlowButton {...args} asChild>
      <Link href="/features">Learn more</Link>
    </RadialGlowButton>
  ),
};

/**
 * Mirrors the mobile header usage: full-width split CTA row with an icon,
 * using `asChild` + `next/link`. The `wrapperClassName` (e.g. `w-full flex-1`)
 * controls the wrapper; `className` styles the glow button itself.
 */
export const FullWidthLink: Story = {
  parameters: {
    layout: "padded",
  },
  render: () => (
    <div className="flex w-full max-w-sm items-center gap-2">
      <RadialGlowButton
        asChild
        size="sm"
        wrapperClassName="w-full flex-1"
        className="w-full text-center"
      >
        <Link href="/login">Sign in</Link>
      </RadialGlowButton>
      <RadialGlowButton
        asChild
        size="sm"
        wrapperClassName="w-full flex-1"
        className="w-full text-center"
      >
        <Link href="/register">
          Sign up
          <ChevronRight className="ml-1.5 inline-block h-4 w-4 align-middle" />
        </Link>
      </RadialGlowButton>
    </div>
  ),
};

/**
 * The reduced-motion state: the glow stays fully visible but the pan/sweep
 * animations are stopped. Set the **Motion** toolbar global to `reduced` to
 * see this live; the story below pins it on so the static state is always
 * visible when selected.
 */
export const ReducedMotion: Story = {
  globals: { motion: "reduced" },
};
