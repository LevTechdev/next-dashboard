"use client";

import {
  Search,
  Sun,
  Moon,
  Monitor,
  LogOut,
  User,
  Settings as SettingsIcon,
  Menu,
  Command,
  Wifi,
  WifiOff,
  Loader2,
  Check,
} from "lucide-react";
import { Particles } from "@/components/ui/particles";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useRealtime } from "@/components/realtime-provider";
import { NotificationPanel } from "@/components/notification-panel";
import { CommandPalette } from "@/components/command-palette";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Realtime Connection Status Badge ──────────────────────────────────────

function RealtimeConnectionBadge() {
  const { connectionStatus } = useRealtime();
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const statusConfig = {
    connected: {
      icon: Wifi,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      label: "Connected",
      pulse: false,
    },
    connecting: {
      icon: Loader2,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      label: "Connecting...",
      pulse: true,
    },
    disconnected: {
      icon: WifiOff,
      color: "text-red-500",
      bg: "bg-red-50 dark:bg-red-900/20",
      label: "Disconnected",
      pulse: false,
    },
  };

  const config = statusConfig[connectionStatus];
  const Icon = config.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setTooltipOpen(!tooltipOpen)}
        onMouseEnter={() => setTooltipOpen(true)}
        onMouseLeave={() => setTooltipOpen(false)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
          config.bg,
          config.color,
          "hover:opacity-80",
        )}
        title={config.label}
      >
        <Icon className={cn("h-3.5 w-3.5", config.pulse && "animate-spin")} />
        <span className="hidden lg:inline">{config.label}</span>
      </button>

      {/* Tooltip popover */}
      {tooltipOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTooltipOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-64 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("p-2 rounded-full", config.bg)}>
                <Icon className={cn("h-4 w-4", config.color, config.pulse && "animate-spin")} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {config.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {connectionStatus === "connected"
                    ? "Receiving live updates via SSE"
                    : connectionStatus === "connecting"
                      ? "Establishing real-time connection..."
                      : "Connection lost. Reconnecting..."}
                </p>
              </div>
            </div>
            {connectionStatus === "connected" && (
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>Auto-refreshing dashboard data</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { user, logout } = useAuth();
  const tnav = useTranslations("nav");
  const tcommon = useTranslations("common");
  const tsettings = useTranslations("settings");

  useEffect(() => setMounted(true), []);

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  const particleColor = mounted && theme === "dark" ? "#818cf8" : "#6366f1";

  return (
    <header className="sticky top-0 z-30 h-14 lg:h-16 border-b border-gray-200/70 dark:border-gray-800/50 overflow-hidden">
      {/* Interactive particle background */}
      <Particles
        className="absolute inset-0 h-full w-full"
        quantity={35}
        size={0.3}
        staticity={35}
        ease={60}
        color={particleColor}
        vx={0.02}
        vy={0.02}
      />
      <div className="relative flex items-center justify-between h-full px-3 lg:px-6 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl">
        {/* Mobile menu + Logo */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={onMenuClick}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 -ml-2"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dashboard</span>
        </div>

        {/* Search / Command Palette Trigger */}
        <div className="flex-1 max-w-md hidden sm:block">
          <button
            onClick={() => {
              document.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "k",
                  metaKey: true,
                  bubbles: true,
                }),
              );
            }}
            className="relative w-full group"
          >
            <div className="flex items-center gap-3 h-9 px-3 bg-gray-50 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700/50 rounded-xl cursor-pointer group-hover:border-gray-300 dark:group-hover:border-gray-600 transition-all duration-200 group-hover:shadow-sm">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="flex-1 text-left text-sm text-gray-400">{tcommon("search")}</span>
              <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px] font-mono text-gray-400 shadow-sm">
                <Command className="h-3 w-3" />
                <span>K</span>
              </kbd>
            </div>
          </button>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Real-time Connection Status */}
          <RealtimeConnectionBadge />

          {/* Theme Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-500 active:scale-95 transition-transform duration-150 rounded-xl"
              >
                {mounted && theme === "dark" ? (
                  <Moon className="h-5 w-5" />
                ) : mounted && theme === "light" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Monitor className="h-5 w-5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>{tsettings("appearance")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[
                { key: "light", icon: Sun, label: tsettings("light") },
                { key: "dark", icon: Moon, label: tsettings("dark") },
                { key: "system", icon: Monitor, label: tsettings("system") },
              ].map(({ key, icon: Icon, label }) => {
                const isSelected = mounted && theme === key;
                return (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setTheme(key)}
                    className={cn(
                      "flex items-center gap-3 cursor-pointer group rounded-lg",
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium"
                        : "text-gray-700 dark:text-gray-300",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-sm">{label}</span>
                    {isSelected ? (
                      <Check className="h-4 w-4 text-indigo-500 animate-in zoom-in-50 duration-200" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Language Toggle */}
          <LanguageToggle locale={pathname.split("/")[1] || "en"} pathname={pathname} />

          {/* Notifications */}
          <NotificationPanel />

          {/* Command Palette (rendered outside the header) */}
          <CommandPalette />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2 rounded-xl">
                <Avatar className="h-8 w-8 ring-2 ring-gray-200 dark:ring-gray-700 ring-offset-2 ring-offset-transparent">
                  <AvatarImage src={(user as any)?.picture || ""} />
                  <AvatarFallback className="text-xs bg-gradient-to-br from-indigo-500 to-indigo-700 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start text-left">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user?.name || "User"}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">
                    {(user as any)?.role?.toLowerCase() || "Staff"}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user?.name}</span>
                  <span className="text-xs text-gray-400 font-normal">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href={`/${pathname.split("/")[1]}/profile`}
                  className="flex items-center cursor-pointer"
                >
                  <User className="h-4 w-4 mr-2" /> {tnav("profile")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`/${pathname.split("/")[1]}/settings`}
                  className="flex items-center cursor-pointer"
                >
                  <SettingsIcon className="h-4 w-4 mr-2" /> {tnav("settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  logout();
                }}
                className="text-red-600 dark:text-red-400 w-full flex items-center cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" /> {tnav("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
