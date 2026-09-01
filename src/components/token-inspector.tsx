"use client";

import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import {
  SunIcon,
  MoonIcon,
  SparklesIcon,
  SearchIcon,
  ListIcon,
  WindIcon,
  PanelRightOpenIcon,
} from "lucide-animated";
import { Monitor, Grid3X3, Palette } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Data Catalog ─────────────────────────────────────────────────────

interface TokenItem {
  id: string;
  category: string;
  label: string;
  render: (ctx: { id: string }) => React.ReactNode;
}

const ALL_TOKENS: TokenItem[] = [
  // ── Colors ──
  {
    id: "color-bg",
    category: "Color Tokens",
    label: "--background",
    render: () => (
      <div className="h-full flex items-center justify-center">
        <div className="space-y-2 text-center">
          <div
            className="w-16 h-16 mx-auto rounded-2xl border-2 border-gray-200 dark:border-gray-700"
            style={{ background: "hsl(var(--background))" }}
          />
          <p className="text-[10px] font-mono text-gray-400">
            hsl(222 20% 97%)
            <br className="hidden sm:block" />→ hsl(225 25% 7%)
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "color-card",
    category: "Color Tokens",
    label: "--card",
    render: () => (
      <div className="h-full flex items-center justify-center">
        <div className="space-y-2 text-center">
          <div
            className="w-16 h-16 mx-auto rounded-2xl border-2 border-gray-200 dark:border-gray-700"
            style={{ background: "hsl(var(--card))" }}
          />
          <p className="text-[10px] font-mono text-gray-400">
            hsl(0 0% 100%)
            <br className="hidden sm:block" />→ hsl(225 20% 12%)
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "color-glow-indigo",
    category: "Color Tokens",
    label: "--glow-indigo",
    render: () => (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl ring-2 ring-white/20"
            style={{ background: "hsl(226, 70%, 55%)" }}
          />
          <div
            className="w-10 h-10 rounded-xl ring-2 ring-white/20 opacity-80"
            style={{ background: "hsl(226, 70%, 55% / 0.5)" }}
          />
          <div
            className="w-10 h-10 rounded-xl ring-2 ring-white/20 opacity-50"
            style={{ background: "hsl(226, 70%, 55% / 0.15)" }}
          />
        </div>
        <p className="text-[10px] font-mono text-gray-400">100% · 50% · 15% opacity</p>
      </div>
    ),
  },
  {
    id: "color-surface",
    category: "Color Tokens",
    label: "--surface-raised",
    render: () => (
      <div className="h-full flex items-center justify-center gap-3">
        {["--surface-raised", "--surface-strong", "--surface-base"].map((v) => (
          <div key={v} className="space-y-1.5 text-center">
            <div
              className="w-12 h-12 mx-auto rounded-xl border border-gray-200 dark:border-gray-700"
              style={{ background: `hsl(var(${v}))` }}
            />
            <span className="text-[8px] font-mono text-gray-400 block truncate max-w-[80px]">
              {v}
            </span>
          </div>
        ))}
      </div>
    ),
  },

  // ── Cards ──
  {
    id: "card-dashboard",
    category: "Cards & Containers",
    label: ".dashboard-card",
    render: () => (
      <div className="h-full flex flex-col justify-center p-3">
        <div className="dashboard-card p-3 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
              $
            </div>
            <div className="flex-1 min-w-0">
              <div className="h-1.5 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-16 rounded-full bg-gray-900 dark:bg-gray-100 mt-1" />
            </div>
          </div>
          <div className="h-1.5 w-20 rounded-full bg-emerald-200 dark:bg-emerald-800" />
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">Hover → indigo border glow</p>
      </div>
    ),
  },
  {
    id: "card-stat",
    category: "Cards & Containers",
    label: ".stat-card-premium",
    render: () => (
      <div className="h-full flex flex-col justify-center p-3">
        <div className="stat-card-premium cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <div className="w-3 h-3 rounded bg-indigo-500" />
            </div>
            <span className="flex items-center gap-0.5 text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              ↑ 12%
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Metric Label</p>
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">2,847</p>
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">Hover → gradient top bar</p>
      </div>
    ),
  },
  {
    id: "card-vengeance",
    category: "Cards & Containers",
    label: ".vengeance-card",
    render: () => (
      <div className="h-full flex flex-col justify-center p-3">
        <div className="vengeance-card p-3 rounded-xl text-center group">
          <div className="w-8 h-8 mx-auto rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-1">
            <SparklesIcon size={14} className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Premium Card</p>
          <p className="text-[8px] text-gray-400">Hover me</p>
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">Hover → lift + gradient border</p>
      </div>
    ),
  },
  {
    id: "card-gradient-border",
    category: "Cards & Containers",
    label: ".gradient-border-card",
    render: () => (
      <div className="h-full flex flex-col justify-center p-3">
        <div className="gradient-border-card p-3 rounded-xl text-center">
          <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
            Gradient Border
          </p>
          <p className="text-[8px] text-gray-400 mt-0.5">Hover to reveal</p>
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">Hover → mask-composite border</p>
      </div>
    ),
  },
  {
    id: "card-spotlight",
    category: "Cards & Containers",
    label: ".spotlight-card",
    render: () => (
      <div className="h-full flex flex-col justify-center p-3">
        <div className="spotlight-card p-3 rounded-xl border border-gray-200 dark:border-gray-700 text-center relative overflow-hidden">
          <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
            Move mouse here
          </p>
          <p className="text-[8px] text-gray-400 mt-0.5">Spotlight follows cursor</p>
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">Radial gradient at mouse XY</p>
      </div>
    ),
  },
  {
    id: "card-double-bezel",
    category: "Cards & Containers",
    label: ".double-bezel",
    render: () => (
      <div className="h-full flex flex-col justify-center p-3">
        <div className="double-bezel">
          <div className="double-bezel-inner text-center !p-3">
            <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
              Nested Card
            </p>
            <p className="text-[8px] text-gray-400">Outer + Inner surfaces</p>
          </div>
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">Two-layer inset effect</p>
      </div>
    ),
  },

  // ── Glass & Surface ──
  {
    id: "glass-vengeance",
    category: "Glass & Surface",
    label: ".vengeance-glass",
    render: () => (
      <div className="h-full flex flex-col justify-center p-4">
        <div className="vengeance-glass rounded-xl p-3 text-center">
          <div className="w-6 h-6 mx-auto rounded-lg bg-white/50 dark:bg-white/10 flex items-center justify-center mb-1">
            <WindIcon size={12} className="w-3 h-3 text-indigo-500" />
          </div>
          <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
            Frosted Glass
          </p>
          <p className="text-[8px] text-gray-400">blur(24px) saturate(1.8)</p>
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">Backdrop blur panel</p>
      </div>
    ),
  },
  {
    id: "glass-panel",
    category: "Glass & Surface",
    label: ".glass-panel",
    render: () => (
      <div className="h-full flex flex-col justify-center p-4">
        <div className="glass-panel rounded-xl p-3 text-center">
          <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
            Standard Glass
          </p>
          <p className="text-[8px] text-gray-400">blur(36px) · inner shine</p>
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">Marketing nav glass</p>
      </div>
    ),
  },

  // ── Buttons ──
  {
    id: "btn-default",
    category: "Buttons",
    label: "Button — default",
    render: () => (
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <Button size="sm">Default</Button>
        <Button variant="secondary" size="sm">
          Secondary
        </Button>
        <p className="text-[8px] text-gray-400">Standard action buttons</p>
      </div>
    ),
  },
  {
    id: "btn-premium",
    category: "Buttons",
    label: "Button — premium + glass",
    render: () => (
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <Button variant="premium" size="sm" className="gap-1.5">
          <SparklesIcon size={12} className="w-3 h-3" />
          Premium
        </Button>
        <Button variant="glass" size="sm">
          Glass
        </Button>
        <p className="text-[8px] text-gray-400">Gradient & frosted variants</p>
      </div>
    ),
  },
  {
    id: "btn-outline-ghost",
    category: "Buttons",
    label: "Button — outline + ghost",
    render: () => (
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <Button variant="outline" size="sm">
          Outline
        </Button>
        <Button variant="ghost" size="sm">
          Ghost
        </Button>
        <p className="text-[8px] text-gray-400">Low-emphasis actions</p>
      </div>
    ),
  },

  // ── Badges ──
  {
    id: "badge-premium",
    category: "Badges & Tags",
    label: ".badge-premium",
    render: () => (
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <span className="badge-premium">
          <SparklesIcon size={10} className="w-2.5 h-2.5" /> Premium
        </span>
        <span className="badge-premium !bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400 !border-emerald-200 dark:!border-emerald-500/20">
          ✓ Verified
        </span>
        <span className="badge-premium !bg-amber-500/10 !text-amber-600 dark:!text-amber-400 !border-amber-200 dark:!border-amber-500/20">
          Beta
        </span>
        <p className="text-[8px] text-gray-400">Indigo tint · 8% → 18% alpha</p>
      </div>
    ),
  },

  // ── Typography ──
  {
    id: "text-gradient",
    category: "Typography & Text",
    label: ".text-gradient-premium",
    render: () => (
      <div className="h-full flex flex-col items-center justify-center gap-2 p-3">
        <p className="text-gradient-premium text-lg font-bold text-center leading-tight">
          Premium
          <br />
          Gradient
        </p>
        <p className="text-gradient-warm text-xs font-semibold text-center">Warm</p>
        <p className="text-gradient-cool text-xs font-semibold text-center">Cool</p>
        <p className="text-gradient-earth text-xs font-semibold text-center">Earth</p>
        <p className="text-[8px] text-gray-400 mt-1">4 gradient text variants</p>
      </div>
    ),
  },

  // ── Effects ──
  {
    id: "effect-global-glow",
    category: "Effects & Micro-Interactions",
    label: ".ambient-glow-indigo",
    render: () => (
      <div className="h-full flex flex-col justify-center p-3">
        <div className="relative h-16 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <div className="absolute inset-0 ambient-glow-indigo" />
          <div className="relative z-10 flex items-center justify-center h-full">
            <p className="text-[9px] font-medium text-gray-500 dark:text-gray-400">
              Ambient Indigo
            </p>
          </div>
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">Section-scale glow (12%→15%)</p>
      </div>
    ),
  },
  {
    id: "effect-glow-border",
    category: "Effects & Micro-Interactions",
    label: ".glow-border",
    render: () => (
      <div className="h-full flex flex-col justify-center p-4">
        <div className="glow-border p-3 rounded-xl border border-gray-200 dark:border-gray-700 text-center bg-white dark:bg-gray-900">
          <p className="text-[9px] font-medium text-gray-600 dark:text-gray-400">Hover me</p>
          <p className="text-[7px] text-gray-400 mt-0.5">Shimmer gradient border</p>
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">glow-shimmer animation</p>
      </div>
    ),
  },
  {
    id: "effect-pulse-dot",
    category: "Effects & Micro-Interactions",
    label: ".pulse-dot",
    render: () => (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-3">
          <span className="pulse-dot bg-emerald-500" />
          <span className="pulse-dot bg-indigo-500" />
          <span className="pulse-dot bg-amber-500" />
        </div>
        <p className="text-[8px] text-gray-400">pulse-ring animation (2s)</p>
      </div>
    ),
  },
  {
    id: "effect-shimmer",
    category: "Effects & Micro-Interactions",
    label: ".shimmer",
    render: () => (
      <div className="h-full flex flex-col items-center justify-center gap-2 p-3">
        <div className="shimmer h-2.5 w-32 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="shimmer h-2.5 w-24 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="shimmer h-2.5 w-28 rounded-full bg-gray-200 dark:bg-gray-700" />
        <p className="text-[8px] text-gray-400 mt-1">shimmer-move loading effect</p>
      </div>
    ),
  },
  {
    id: "effect-feature-card",
    category: "Effects & Micro-Interactions",
    label: ".feature-card",
    render: () => (
      <div className="h-full flex flex-col justify-center p-3">
        <div className="feature-card p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-center cursor-default">
          <div className="feature-icon-wrap w-7 h-7 mx-auto rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-1">
            <SparklesIcon size={12} className="w-3 h-3 text-indigo-500" />
          </div>
          <p className="text-[9px] font-medium text-gray-700 dark:text-gray-300">Feature Card</p>
          <p className="feature-arrow text-[8px] text-indigo-500 mt-0.5">Hover →</p>
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">Lift + icon scale + arrow slide</p>
      </div>
    ),
  },

  // ── Navigation ──
  {
    id: "nav-sidebar",
    category: "Navigation",
    label: ".sidebar-item / -active",
    render: () => (
      <div className="h-full flex flex-col justify-center p-3">
        <div className="space-y-1">
          {["Dashboard", "Analytics", "Settings"].map((name, i) => (
            <div
              key={name}
              className={cn(
                "sidebar-item px-3 py-2 rounded-lg text-xs font-medium",
                i === 1 && "sidebar-item-active",
              )}
            >
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  i === 0 && "bg-gray-300 dark:bg-gray-600",
                  i === 1 && "bg-indigo-500",
                  i === 2 && "bg-gray-300 dark:bg-gray-600",
                )}
              />
              {name}
            </div>
          ))}
        </div>
        <p className="text-[9px] text-gray-400 mt-2">Active item with left accent bar</p>
      </div>
    ),
  },

  // ── Motion ──
  {
    id: "motion-classes",
    category: "Motion Utilities",
    label: ".motion-spring / .press-scale",
    render: () => (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-3">
        <div className="flex flex-wrap gap-2 justify-center">
          <span className="px-2 py-1 rounded-lg text-[9px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            .motion-spring
          </span>
          <span className="px-2 py-1 rounded-lg text-[9px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            .motion-spring-fast
          </span>
          <span className="px-2 py-1 rounded-lg text-[9px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            .motion-spring-slow
          </span>
        </div>{" "}
        <button className="press-scale px-4 py-2 rounded-xl text-xs font-medium bg-indigo-500 text-white">
          .press-scale (click me)
        </button>
        <p className="text-[8px] text-gray-400">Spring curves & press feedback</p>
      </div>
    ),
  },
];

const CATEGORIES = Array.from(new Set(ALL_TOKENS.map((t) => t.category)));

// ─── Token Preview Card ──────────────────────────────────────────────

function TokenPreviewCard({ token, searchTerm }: { token: TokenItem; searchTerm: string }) {
  const [isHovered, setIsHovered] = useState(false);

  // Highlight search matches
  const highlightLabel = (label: string) => {
    if (!searchTerm) return label;
    const idx = label.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (idx === -1) return label;
    return (
      <>
        {label.slice(0, idx)}
        <mark className="bg-amber-200 dark:bg-amber-700/60 text-inherit rounded-sm px-0.5">
          {label.slice(idx, idx + searchTerm.length)}
        </mark>
        {label.slice(idx + searchTerm.length)}
      </>
    );
  };

  return (
    <div
      className={cn(
        "group relative rounded-2xl border transition-all duration-300 overflow-hidden",
        "bg-white dark:bg-[hsl(225,20%,12%)]",
        isHovered
          ? "border-indigo-300 dark:border-indigo-500/40 shadow-lg shadow-indigo-500/5 dark:shadow-indigo-500/10"
          : "border-gray-200 dark:border-gray-700/50 shadow-sm",
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Preview area */}
      <div className="aspect-[4/3] bg-gray-50/50 dark:bg-gray-900/30 overflow-hidden">
        <div
          className={cn(
            "w-full h-full transition-transform duration-500",
            isHovered && "scale-[1.02]",
          )}
        >
          <token.render id={token.id} />
        </div>
      </div>

      {/* Label bar */}
      <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <code className="text-[11px] font-mono font-semibold text-gray-800 dark:text-gray-200 truncate">
            {highlightLabel(token.label)}
          </code>
          <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[8px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800">
            {token.category === "Color Tokens" ? "var" : "class"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Split-View Toggle ───────────────────────────────────────────────

function SplitViewToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200",
        enabled
          ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
      )}
    >
      <PanelRightOpenIcon size={14} className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Split View</span>
    </button>
  );
}

// ─── View Mode Toggle ────────────────────────────────────────────────

function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: "grid" | "list";
  onChange: (m: "grid" | "list") => void;
}) {
  return (
    <div className="flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <button
        onClick={() => onChange("grid")}
        className={cn(
          "p-1.5 rounded-md transition-all",
          mode === "grid"
            ? "bg-white dark:bg-gray-700 shadow-sm text-gray-700 dark:text-gray-300"
            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-400",
        )}
      >
        <Grid3X3 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onChange("list")}
        className={cn(
          "p-1.5 rounded-md transition-all",
          mode === "list"
            ? "bg-white dark:bg-gray-700 shadow-sm text-gray-700 dark:text-gray-300"
            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-400",
        )}
      >
        <ListIcon size={14} className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Theme Switcher ──────────────────────────────────────────────────

function ThemeSwitcher({
  mounted,
  theme,
  setTheme,
}: {
  mounted: boolean;
  theme: string | undefined;
  setTheme: (t: string) => void;
}) {
  const options = [
    { key: "light", icon: SunIcon, label: "Light" },
    { key: "dark", icon: MoonIcon, label: "Dark" },
    { key: "system", icon: Monitor, label: "System" },
  ];

  return (
    <div className="flex items-center gap-1 p-0.5 bg-gray-100/80 dark:bg-gray-800/80 rounded-xl">
      {options.map(({ key, icon: Icon, label }) => {
        const isSelected = mounted && theme === key;
        return (
          <button
            key={key}
            onClick={() => setTheme(key)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
              isSelected
                ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-gray-100"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
            )}
          >
            <Icon size={14} className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Floating Header ─────────────────────────────────────────────────

function FloatingHeader({
  mounted,
  theme,
  setTheme,
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  splitView,
  onSplitViewToggle,
}: {
  mounted: boolean;
  theme: string | undefined;
  setTheme: (t: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (m: "grid" | "list") => void;
  splitView: boolean;
  onSplitViewToggle: () => void;
}) {
  return (
    <div className="sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-3 mb-6 bg-gradient-to-b from-white via-white/95 to-transparent dark:from-[hsl(225,25%,7%)] dark:via-[hsl(225,25%,7%)/95] dark:to-transparent backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4">
        {/* Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 shrink-0">
            <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">Token Inspector</h1>
            <p className="text-[10px] text-gray-400 hidden sm:block">
              Figma-style design system catalog
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 sm:ml-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none">
            <SearchIcon
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter tokens..."
              className={cn(
                "w-full sm:w-44 pl-7 pr-2.5 py-1.5 rounded-lg text-xs border transition-all duration-200",
                "bg-gray-50 dark:bg-gray-900/80 border-gray-200 dark:border-gray-700/50",
                "text-gray-900 dark:text-gray-100 placeholder:text-gray-400",
                "focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-500",
              )}
            />
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[10px] text-gray-400">|</span>
          </div>

          <SplitViewToggle enabled={splitView} onToggle={onSplitViewToggle} />
          <ViewModeToggle mode={viewMode} onChange={onViewModeChange} />
          <ThemeSwitcher mounted={mounted} theme={theme} setTheme={setTheme} />
        </div>
      </div>
    </div>
  );
}

// ─── Category Section ────────────────────────────────────────────────

function CategorySection({
  name,
  tokens,
  searchTerm,
  viewMode,
}: {
  name: string;
  tokens: TokenItem[];
  searchTerm: string;
  viewMode: "grid" | "list";
}) {
  if (tokens.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {name}
        </h2>
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700/50" />
        <span className="text-[10px] font-mono text-gray-300 dark:text-gray-600">
          {tokens.length} items
        </span>
      </div>
      <div
        className={cn(
          viewMode === "grid"
            ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
            : "space-y-2",
        )}
      >
        {tokens.map((token) => (
          <TokenPreviewCard key={token.id} token={token} searchTerm={searchTerm} />
        ))}
      </div>
    </section>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function TokenInspector({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [splitView, setSplitView] = useState(false);

  useEffect(() => setMounted(true), []);

  const filteredTokens = useMemo(() => {
    if (!search.trim()) return ALL_TOKENS;
    const q = search.toLowerCase();
    return ALL_TOKENS.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q),
    );
  }, [search]);

  const groupedTokens = useMemo(() => {
    const groups: Record<string, TokenItem[]> = {};
    for (const token of filteredTokens) {
      if (!groups[token.category]) groups[token.category] = [];
      groups[token.category].push(token);
    }
    return groups;
  }, [filteredTokens]);

  const totalCount = ALL_TOKENS.length;
  const shownCount = filteredTokens.length;

  if (!mounted) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="h-12 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div
                  key={j}
                  className="aspect-[4/3] rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("", className)}>
      <FloatingHeader
        mounted={mounted}
        theme={theme}
        setTheme={setTheme}
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        splitView={splitView}
        onSplitViewToggle={() => setSplitView(!splitView)}
      />

      {/* Split view row */}
      {splitView && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Light mode column */}
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                <SunIcon size={14} className="w-3.5 h-3.5 text-amber-500" />
                Light Mode
              </span>
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
            </div>
            <div className="p-4 space-y-3" style={{ background: "hsl(222,20%,97%)" }}>
              <div
                className="h-2 w-24 rounded-full"
                style={{ background: "hsl(225,25%,7%,0.1)" }}
              />
              <div
                className="h-16 rounded-xl bg-white border"
                style={{ borderColor: "hsl(225,15%,90%)" }}
              >
                <div className="p-3 flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-lg"
                    style={{ background: "hsl(226,70%,55%,0.1)" }}
                  />
                  <div className="flex-1 space-y-1.5">
                    <div
                      className="h-1.5 w-16 rounded-full"
                      style={{ background: "hsl(225,25%,7%,0.2)" }}
                    />
                    <div
                      className="h-1.5 w-10 rounded-full"
                      style={{ background: "hsl(225,15%,50%)" }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <div
                  className="flex-1 h-8 rounded-lg bg-white border"
                  style={{ borderColor: "hsl(225,15%,90%)" }}
                />
                <div className="h-8 w-20 rounded-lg" style={{ background: "hsl(226,70%,55%)" }} />
              </div>
            </div>
          </div>

          {/* Dark mode column */}
          <div
            className="rounded-2xl overflow-hidden border"
            style={{ borderColor: "rgba(255,255,255,0.07)", background: "hsl(225,25%,7%)" }}
          >
            <div
              className="flex items-center justify-between px-4 py-2 border-b"
              style={{ background: "hsl(224,18%,14%)", borderColor: "rgba(255,255,255,0.06)" }}
            >
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <MoonIcon size={14} className="w-3.5 h-3.5 text-blue-400" />
                Dark Mode
              </span>
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="h-2 w-24 rounded-full bg-white/10" />
              <div
                className="h-16 rounded-xl"
                style={{ background: "hsl(225,20%,12%)", border: "1px solid hsl(225,15%,26%)" }}
              >
                <div className="p-3 flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-lg"
                    style={{ background: "hsl(226,70%,55%,0.2)" }}
                  />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-1.5 w-16 rounded-full bg-white/20" />
                    <div
                      className="h-1.5 w-10 rounded-full"
                      style={{ background: "hsl(225,10%,65%)" }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <div
                  className="flex-1 h-8 rounded-lg"
                  style={{ background: "hsl(225,20%,12%)", border: "1px solid hsl(225,15%,26%)" }}
                />
                <div className="h-8 w-20 rounded-lg" style={{ background: "hsl(226,70%,55%)" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results summary */}
      <div className="flex items-center gap-2 mb-6 text-[11px] text-gray-400">
        <span>
          {shownCount} of {totalCount} tokens
        </span>
        {search && shownCount === 0 && (
          <span className="text-amber-500">— no matches for &ldquo;{search}&rdquo;</span>
        )}
      </div>

      {/* Token sections */}
      {CATEGORIES.map((cat) => {
        const tokens = groupedTokens[cat] || [];
        return (
          <CategorySection
            key={cat}
            name={cat}
            tokens={tokens}
            searchTerm={search}
            viewMode={viewMode}
          />
        );
      })}

      {shownCount === 0 && search && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <SearchIcon size={32} className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No tokens match &ldquo;{search}&rdquo;
          </p>
          <button
            onClick={() => setSearch("")}
            className="mt-2 text-xs text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700/50 text-center">
        <p className="text-[10px] text-gray-400">
          Powered by <code className="font-mono text-gray-500 dark:text-gray-400">globals.css</code>{" "}
          · {totalCount} premium design tokens & classes
        </p>
        <p className="text-[9px] text-gray-300 dark:text-gray-600 mt-1">
          All components render live with the current active theme
        </p>
      </div>
    </div>
  );
}
