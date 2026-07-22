import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { Button } from "./button";
import { TrendingUp, DollarSign, Users, ArrowUpRight } from "lucide-react";

/**
 * Premium card system with 6 subcomponents and 3 premium class variants.
 *
 * **CSS Classes Used:**
 * - `.dashboard-card` — Base card with hover indigo glow border
 * - `.stat-card-premium` — Dashboard stat with gradient top bar on hover
 * - `.double-bezel` / `.double-bezel-inner` — Nested inset card
 * - `.vengeance-card` — Hover-lift card with animated gradient border
 * - `.gradient-border-card` — Mask-composite gradient border on hover
 *
 * **Design Tokens Used:**
 * - `--card` / `--card-foreground` — Card surface and heading text
 * - `--surface-raised` / `--surface-strong` — Surface layer tokens
 * - `--border-muted` / `--border` — Card border tokens
 * - `--card-shadow` / `--card-shadow-hover` — Shadow depth tokens
 * - `--glow-indigo` — Hover glow color
 */
const meta: Meta<typeof Card> = {
  title: "Design System/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Six Card subcomponents: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.\n\nAll cards use the `.dashboard-card` CSS class by default, which provides the base card surface with `--card` background, `--border` border, and `--card-shadow` box-shadow. On hover the border glows with `--glow-indigo`.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

// ── Subcomponents ──────────────────────────────────────────────────

export const Default: Story = {
  parameters: { docs: { description: { story: "Standard card with header, content, and footer sections." } } },
  render: () => (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description with supporting text.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Main content area using `.dashboard-card` base class. Background uses `--card` token.
        </p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" size="sm">Cancel</Button>
        <Button size="sm">Save</Button>
      </CardFooter>
    </Card>
  ),
};

export const DashboardCard: Story = {
  parameters: { docs: { description: { story: "Revenue stat card using `.dashboard-card`. Hover to see the indigo border glow." } } },
  render: () => (
    <div className="dashboard-card p-5 rounded-xl w-full max-w-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
          <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20">
          <TrendingUp className="h-3 w-3" /> 23.5%
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">$89,200</p>
    </div>
  ),
};

// ── Stat Card Premium ──────────────────────────────────────────────

export const StatCardPremium: Story = {
  parameters: { docs: { description: { story: "Premium stat card using `.stat-card-premium`. Hover to reveal the gradient top bar (`--gradient-premium`)." } } },
  render: () => (
    <div className="stat-card-premium w-full max-w-xs cursor-pointer">
      <div className="flex items-center justify-between">
        <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
          <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <span className="flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20">
          <TrendingUp className="h-3 w-3" /> 12%
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Active Users</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">2,847</p>
    </div>
  ),
};

// ── All Card Variants Grid ─────────────────────────────────────────

export const AllVariants: Story = {
  parameters: { docs: { description: { story: "Side-by-side comparison of all card variants. Hover each to see the different effects." } } },
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
      {/* Dashboard Card */}
      <div className="dashboard-card p-4 rounded-xl">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">dashboard-card</p>
        <p className="text-sm text-gray-700 dark:text-gray-300">Hover → indigo border glow + shadow lift</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <ArrowUpRight className="h-3 w-3" /> +12.5%
        </div>
      </div>

      {/* Stat Card Premium */}
      <div className="stat-card-premium cursor-pointer">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">stat-card-premium</p>
        <p className="text-sm text-gray-700 dark:text-gray-300">Hover → gradient top bar + lift</p>
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-2">$12.4k</p>
      </div>

      {/* Double Bezel */}
      <div className="double-bezel">
        <div className="double-bezel-inner">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">double-bezel</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">Nested outer + inner surfaces</p>
        </div>
      </div>
    </div>
  ),
};

// ── KPI Row Example ────────────────────────────────────────────────

export const KPIRow: Story = {
  parameters: { docs: { description: { story: "Real-world KPI row using `.dashboard-card` (first) and `.stat-card-premium` (second) classes." } } },
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
      <div className="dashboard-card p-4 rounded-xl">
        <p className="text-xs text-gray-400">Revenue</p>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">$48,290</p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">↑ 14.2%</p>
      </div>
      <div className="stat-card-premium">
        <p className="text-xs text-gray-400">Orders</p>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">1,842</p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">↑ 8.1%</p>
      </div>
      <div className="stat-card-premium">
        <p className="text-xs text-gray-400">Conversion</p>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">3.24%</p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">↓ 0.3%</p>
      </div>
    </div>
  ),
};
