"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  CheckIcon,
  SunIcon,
  MoonIcon,
  SparklesIcon,
  EyeIcon,
  LayersIcon,
  TrendingUpIcon,
  DollarSignIcon,
  ZapIcon,
  UsersIcon,
} from "lucide-animated";
import { Monitor, Palette, SwatchBook, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Token Color Dot ──────────────────────────────────────────────────

function TokenSwatch({
  label,
  variable,
  className,
}: {
  label: string;
  variable: string;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 group cursor-default">
      <div
        className={cn(
          "h-7 w-7 rounded-lg border border-gray-200 dark:border-gray-700 shrink-0 ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-200 group-hover:scale-110",
          className,
        )}
        style={{ background: `hsl(var(${variable}))` }}
      />
      <div className="flex flex-col">
        <span className="text-[11px] font-mono font-medium text-gray-700 dark:text-gray-300 leading-tight">
          {label}
        </span>
        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{variable}</span>
      </div>
    </div>
  );
}

// ─── Theme Selector Row ────────────────────────────────────────────────

function ThemeSelectorRow({
  mounted,
  theme,
  setTheme,
}: {
  mounted: boolean;
  theme: string | undefined;
  setTheme: (t: string) => void;
}) {
  const options = [
    { key: "light", icon: SunIcon, label: "Light", iconColor: "text-amber-500" },
    { key: "dark", icon: MoonIcon, label: "Dark", iconColor: "text-blue-500" },
    { key: "system", icon: Monitor, label: "System", iconColor: "text-gray-500" },
  ];

  return (
    <div className="flex items-center gap-2 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-2xl w-fit">
      {options.map(({ key, icon: Icon, label, iconColor }) => {
        const isSelected = mounted && theme === key;
        return (
          <button
            key={key}
            onClick={() => setTheme(key)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
              isSelected
                ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-gray-100"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
            )}
          >
            <Icon size={16} className={cn("h-4 w-4", iconColor)} />
            <span>{label}</span>
            {isSelected && (
              <span className="absolute -top-1 -right-1">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-white">
                  <CheckIcon size={10} className="h-2.5 w-2.5" />
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Token Palette Grid ────────────────────────────────────────────────

function TokenPalette() {
  const lightTokens = [
    {
      label: "Background",
      variable: "--background",
      className: "bg-[hsl(222,20%,97%)] dark:bg-[hsl(225,25%,7%)]",
    },
    {
      label: "Foreground",
      variable: "--foreground",
      className: "bg-[hsl(225,25%,7%)] dark:bg-[hsl(210,40%,98%)]",
    },
    { label: "Card", variable: "--card", className: "bg-white dark:bg-[hsl(225,20%,12%)]" },
    {
      label: "Border",
      variable: "--border",
      className: "bg-[hsl(225,15%,90%)] dark:bg-[hsl(225,15%,26%)]",
    },
    {
      label: "Surface Raised",
      variable: "--surface-raised",
      className: "bg-[hsl(220,20%,97%)] dark:bg-[hsl(224,20%,11%)]",
    },
    {
      label: "Muted",
      variable: "--muted",
      className: "bg-[hsl(210,20%,96%)] dark:bg-[hsl(224,18%,14%)]",
    },
  ];

  const glowTokens = [
    { label: "Glow Indigo", variable: "--glow-indigo", className: "bg-[hsl(226,70%,55%)]" },
    { label: "Glow Emerald", variable: "--glow-emerald", className: "bg-emerald-500" },
    { label: "Glow Purple", variable: "--glow-purple", className: "bg-purple-500" },
    { label: "Glow Blue", variable: "--glow-blue", className: "bg-blue-500" },
    { label: "Destructive", variable: "--destructive", className: "bg-red-500 dark:bg-red-600" },
    {
      label: "Ring",
      variable: "--ring",
      className: "bg-[hsl(225,25%,7%)] dark:bg-[hsl(210,40%,90%)]",
    },
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
        <SwatchBook className="h-3.5 w-3.5" />
        Core Design Tokens
      </h4>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {lightTokens.map((t) => (
          <TokenSwatch key={t.variable} {...t} />
        ))}
      </div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2 mt-3">
        <Palette className="h-3.5 w-3.5" />
        Accent & Glow Colors
      </h4>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {glowTokens.map((t) => (
          <TokenSwatch key={t.variable} {...t} />
        ))}
      </div>
    </div>
  );
}

// ─── Component Demo Grid ──────────────────────────────────────────────

function ComponentDemos() {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
        <LayersIcon size={14} className="h-3.5 w-3.5" />
        Component Examples
      </h4>

      {/* Button Variants */}
      <div className="space-y-2">
        <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Buttons
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">Default</Button>
          <Button variant="secondary" size="sm">
            Secondary
          </Button>
          <Button variant="outline" size="sm">
            Outline
          </Button>
          <Button variant="premium" size="sm" className="gap-1.5">
            <SparklesIcon size={12} className="h-3 w-3" />
            Premium
          </Button>
          <Button variant="glass" size="sm">
            Glass
          </Button>
          <Button variant="ghost" size="sm">
            Ghost
          </Button>
          <Button variant="link" size="sm">
            Link
          </Button>
        </div>
      </div>

      {/* Cards + Glass */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Dashboard Card
          </p>
          <div className="dashboard-card p-4 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <DollarSignIcon
                  size={16}
                  className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">$89,200</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUpIcon size={12} className="h-3 w-3" />
              +23.5% vs last month
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Stat Card (hover me)
          </p>
          <div className="stat-card-premium cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
                <UsersIcon size={16} className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20">
                <TrendingUpIcon size={10} className="h-2.5 w-2.5" />
                +12%
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Active Users</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">2,847</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Glass Panel
          </p>
          <div className="vengeance-glass rounded-xl p-4 h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-white/50 dark:bg-white/10">
                <ZapIcon size={14} className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Quick Action
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
              Frosted glass surface with backdrop blur — works on any background.
            </p>
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="space-y-2">
        <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Badges
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="badge-premium">
            <SparklesIcon size={10} className="h-2.5 w-2.5" />
            Premium
          </span>
          <span className="badge-premium !bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400 !border-emerald-200 dark:!border-emerald-500/20">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Verified
          </span>
          <span className="badge-premium !bg-amber-500/10 !text-amber-600 dark:!text-amber-400 !border-amber-200 dark:!border-amber-500/20">
            Beta
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            Default
          </span>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Progress
        </p>
        <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full w-[67%] rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
        </div>
      </div>
    </div>
  );
}

// ─── Theme Comparison Cards ─────────────────────────────────────────

function ThemeComparison({ mounted }: { mounted: boolean }) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
        <EyeIcon size={14} className="h-3.5 w-3.5" />
        Theme Comparison
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Light Card */}
        <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <SunIcon size={12} className="h-3 w-3 text-amber-500" />
              Light Mode
            </span>
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
          </div>
          <div className="p-4 space-y-3 bg-[hsl(222,20%,97%)]">
            <div className="h-2 w-24 rounded-full bg-[hsl(225,25%,7%)]/10" />
            <div className="h-16 rounded-xl bg-white border border-[hsl(225,15%,90%)] p-3 flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-[hsl(226,70%,55%)]/10" />
              <div className="flex-1 space-y-1">
                <div className="h-1.5 w-16 rounded-full bg-[hsl(225,25%,7%)]/20" />
                <div className="h-1.5 w-10 rounded-full bg-[hsl(225,15%,50%)]" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 h-8 rounded-lg bg-white border border-[hsl(225,15%,90%)]" />
              <div className="h-8 w-20 rounded-lg bg-[hsl(226,70%,55%)]" />
            </div>
          </div>
        </div>

        {/* Dark Card */}
        <div className="rounded-2xl overflow-hidden border border-gray-700/50 shadow-sm bg-[hsl(225,25%,7%)]">
          <div className="flex items-center justify-between px-4 py-2 bg-[hsl(224,18%,14%)] border-b border-gray-700/30">
            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <MoonIcon size={12} className="h-3 w-3 text-blue-400" />
              Dark Mode
            </span>
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="h-2 w-24 rounded-full bg-white/10" />
            <div className="h-16 rounded-xl bg-[hsl(225,20%,12%)] border border-[hsl(225,15%,26%)] p-3 flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-[hsl(226,70%,55%)]/20" />
              <div className="flex-1 space-y-1">
                <div className="h-1.5 w-16 rounded-full bg-white/20" />
                <div className="h-1.5 w-10 rounded-full bg-[hsl(225,10%,65%)]" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 h-8 rounded-lg bg-[hsl(225,20%,12%)] border border-[hsl(225,15%,26%)]" />
              <div className="h-8 w-20 rounded-lg bg-[hsl(226,70%,55%)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Showcase Component ────────────────────────────────────────

export function ThemeShowcase({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className={cn("space-y-8 animate-pulse", className)}>
        <div className="h-8 w-48 rounded-xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-10 w-72 rounded-2xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-64 rounded-2xl bg-gray-200 dark:bg-gray-800" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-8", className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
              <Palette className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </span>
            Design System Showcase
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-1">
            Explore the premium design tokens, components, and theme behavior
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
            Current:
            {mounted ? (
              <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold">
                {theme === "dark" ? (
                  <MoonIcon size={12} className="h-3 w-3" />
                ) : theme === "light" ? (
                  <SunIcon size={12} className="h-3 w-3" />
                ) : (
                  <Monitor className="h-3 w-3" />
                )}
                {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System"}
              </span>
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>

      {/* Theme Selector */}
      <ThemeSelectorRow mounted={mounted} theme={theme} setTheme={setTheme} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-fit">
          <TabsTrigger value="preview" className="gap-2">
            <EyeIcon size={16} className="h-4 w-4" />
            Live Preview
          </TabsTrigger>
          <TabsTrigger value="tokens" className="gap-2">
            <SwatchBook className="h-4 w-4" />
            Design Tokens
          </TabsTrigger>
          <TabsTrigger value="components" className="gap-2">
            <LayersIcon size={16} className="h-4 w-4" />
            Components
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-6 space-y-6">
          <ThemeComparison mounted={mounted} />
          <div className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 dark:from-indigo-500/10 dark:via-purple-500/10 dark:to-pink-500/10 border border-indigo-200/50 dark:border-indigo-500/20">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Theme transitions are enabled</span>
            </div>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Switch above to see smooth 350ms morphing
            </span>
          </div>
        </TabsContent>

        <TabsContent value="tokens" className="mt-6">
          <TokenPalette />
        </TabsContent>

        <TabsContent value="components" className="mt-6">
          <ComponentDemos />
        </TabsContent>
      </Tabs>
    </div>
  );
}
