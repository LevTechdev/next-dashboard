import type { Meta, StoryObj } from "@storybook/react";
import { Sparkles, Wind } from "lucide-react";

/**
 * Premium glass and surface components powered by CSS classes from `globals.css`.
 *
 * **CSS Classes:**
 * - `.vengeance-glass` — Frosted glass with `blur(24px) saturate(1.8)` via `--glass-bg` / `--glass-border`
 * - `.glass-panel` — Standard glass with `blur(24px)` and inner top highlight
 * - `.vengeance-card` — Hover-lift card with animated gradient border (`--glow-indigo`)
 * - `.gradient-border-card` — Card with `mask-composite: exclude` gradient border
 * - `.spotlight-card` — Card with mouse-tracking radial gradient overlay
 *
 * **Design Tokens:**
 * - `--glass-bg` — Light: `rgba(255,255,255,0.6)` / Dark: `rgba(10,11,16,0.8)`
 * - `--glass-border` — Light: `rgba(0,0,0,0.06)` / Dark: `rgba(255,255,255,0.07)`
 * - `--glass-shadow` — Inner top highlight for depth
 * - `--glow-indigo` — Gradient border and spotlight color
 * - `--card-shadow` / `--card-shadow-hover` — Surface shadow depth
 * - `--surface-raised` / `--surface-strong` — Surface layer backgrounds
 */
const meta: Meta = {
  title: "Design System/Glass & Surface",
  tags: ["autodocs"],
};

export default meta;

// ── Vengeance Glass ────────────────────────────────────────────────

export const VengeanceGlass: StoryObj = {
  parameters: { docs: { description: { story: "Premium frosted glass panel using `.vengeance-glass`. Background: `--glass-bg`, border: `--glass-border`, blur: `24px` + `saturate(1.8)`." } } },
  render: () => (
    <div className="relative w-full max-w-sm min-h-[200px] rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 dark:from-indigo-500/30 dark:via-purple-500/30 dark:to-pink-500/30 flex items-center justify-center p-6">
      <div className="vengeance-glass rounded-2xl p-5 w-full">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-white/50 dark:bg-white/10">
            <Wind className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Frosted Panel</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">blur(24px) saturate(1.8)</p>
          </div>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          Glass surfaces adapt their transparency and saturation automatically between light and dark themes.
        </p>
        <div className="mt-4 flex gap-2">
          <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">--glass-bg</span>
          <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">--glass-border</span>
        </div>
      </div>
    </div>
  ),
};

// ── Glass Panel ────────────────────────────────────────────────────

export const GlassPanel: StoryObj = {
  parameters: { docs: { description: { story: "Standard glass panel using `.glass-panel`. Used for marketing navigation and overlay panels." } } },
  render: () => (
    <div className="relative w-full max-w-sm min-h-[180px] rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/20 to-red-500/20 dark:from-amber-500/30 dark:via-orange-500/30 dark:to-red-500/30 flex items-center justify-center p-6">
      <div className="glass-panel rounded-2xl p-5 w-full text-center">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Standard Glass</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">blur(24px) · inner top shine</p>
        <div className="mt-3 flex justify-center gap-2">
          <span className="text-[10px] font-mono text-gray-400">Light: 60% white</span>
          <span className="text-[10px] font-mono text-gray-400">Dark: 75% black</span>
        </div>
      </div>
    </div>
  ),
};

// ── Vengeance Card ─────────────────────────────────────────────────

export const VengeanceCard: StoryObj = {
  parameters: { docs: { description: { story: "Premium card with hover-lift and animated gradient border (`--glow-indigo`). Hover to see the lift and gradient shine." } } },
  render: () => (
    <div className="w-full max-w-sm">
      <div className="vengeance-card p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Vengeance Card</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          Hover to lift 4px with shadow deepening. Gradient border fades in at 8% opacity (15% in dark mode).
        </p>
        <div className="mt-4 flex gap-3">
          <span className="text-[10px] font-mono text-indigo-500">--glow-indigo</span>
          <span className="text-[10px] font-mono text-gray-400">--card-shadow-hover</span>
        </div>
      </div>
    </div>
  ),
};

// ── Gradient Border Card ───────────────────────────────────────────

export const GradientBorderCard: StoryObj = {
  parameters: { docs: { description: { story: "Card with `mask-composite: exclude` gradient border. Hover to reveal the indigo→purple→blue gradient edge." } } },
  render: () => (
    <div className="w-full max-w-sm">
      <div className="gradient-border-card p-6 rounded-xl">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Gradient Border</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          Hover to reveal the 1px gradient border created with CSS mask-composite. Border uses `--glow-indigo`, `--glow-purple`, and `--glow-blue` tokens.
        </p>
        <div className="mt-4 flex gap-2">
          <span className="text-[10px] font-mono text-purple-500">--glow-purple</span>
          <span className="text-[10px] font-mono text-blue-500">--glow-blue</span>
        </div>
      </div>
    </div>
  ),
};

// ── Spotlight Card ─────────────────────────────────────────────────

export const SpotlightCard: StoryObj = {
  parameters: { docs: { description: { story: "Card with mouse-tracking radial spotlight. Move your mouse inside the card to see the highlight track its position via `--mouse-x` / `--mouse-y` CSS variables." } } },
  render: () => (
    <div className="w-full max-w-sm">
      <div
        className="spotlight-card p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--mouse-x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
          e.currentTarget.style.setProperty("--mouse-y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
        }}
      >
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Spotlight Card</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          Move your mouse — the spotlight follows via `--mouse-x` / `--mouse-y` CSS variables. Spotlight uses `--glow-indigo` at 6% opacity (12% in dark mode).
        </p>
        <div className="mt-4 flex gap-2">
          <span className="text-[10px] font-mono text-indigo-500">--mouse-x</span>
          <span className="text-[10px] font-mono text-indigo-500">--mouse-y</span>
        </div>
      </div>
    </div>
  ),
};

// ── All Glass Variants ─────────────────────────────────────────────

export const AllVariants: StoryObj = {
  parameters: { docs: { description: { story: "Complete grid of all glass and surface variants for visual comparison." } } },
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
      <div className="vengeance-glass rounded-xl p-4">
        <p className="text-[10px] font-mono text-gray-400 mb-1">.vengeance-glass</p>
        <p className="text-xs text-gray-700 dark:text-gray-300">blur+saturate glass</p>
      </div>
      <div className="glass-panel rounded-xl p-4">
        <p className="text-[10px] font-mono text-gray-400 mb-1">.glass-panel</p>
        <p className="text-xs text-gray-700 dark:text-gray-300">standard glass</p>
      </div>
      <div className="vengeance-card p-4 rounded-xl">
        <p className="text-[10px] font-mono text-gray-400 mb-1">.vengeance-card</p>
        <p className="text-xs text-gray-700 dark:text-gray-300">hover-lift gradient</p>
      </div>
      <div className="gradient-border-card p-4 rounded-xl">
        <p className="text-[10px] font-mono text-gray-400 mb-1">.gradient-border-card</p>
        <p className="text-xs text-gray-700 dark:text-gray-300">mask border on hover</p>
      </div>
      <div className="spotlight-card p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <p className="text-[10px] font-mono text-gray-400 mb-1">.spotlight-card</p>
        <p className="text-xs text-gray-700 dark:text-gray-300">mouse-tracking glow</p>
      </div>
      <div className="double-bezel">
        <div className="double-bezel-inner">
          <p className="text-[10px] font-mono text-gray-400 mb-1">.double-bezel</p>
          <p className="text-xs text-gray-700 dark:text-gray-300">nested inset card</p>
        </div>
      </div>
    </div>
  ),
};
