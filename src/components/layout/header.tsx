"use client";

import {
  WifiIcon,
  CheckIcon,
  SearchIcon,
  SunIcon,
  MoonIcon,
  LogoutIcon,
  UserIcon,
  SettingsIcon,
  MenuIcon,
} from "lucide-animated";
import { Monitor, Command, WifiOff, Loader2 } from "lucide-react";
import { Particles } from "@/components/ui/particles";
import { useTheme } from "next-themes";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { CurrencySwitcher } from "@/components/layout/currency-switcher";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { useRealtime } from "@/components/realtime-provider";
import { NotificationPanel } from "@/components/notification-panel";
import { CommandPalette } from "@/components/command-palette";
import { useConfirm } from "@/components/ui/confirm-provider";
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
  const t = useTranslations("telemetry");
  const { connectionStatus, triggerRefresh, lastGlobalUpdate } = useRealtime();
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 250);
  };

  const statusConfig = {
    connected: {
      icon: WifiIcon,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/30",
      label: t("connected"),
      desc: t("descConnected"),
      pulse: false,
    },
    connecting: {
      icon: Loader2,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-500/30",
      label: t("connecting"),
      desc: t("descConnecting"),
      pulse: true,
    },
    disconnected: {
      icon: WifiOff,
      color: "text-red-500",
      bg: "bg-red-50 dark:bg-red-950/40 border-red-500/30",
      label: t("disconnected"),
      desc: t("descDisconnected"),
      pulse: false,
    },
  };

  const config = statusConfig[connectionStatus] || statusConfig.connected;
  const Icon = config.icon;

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer",
          config.bg,
          config.color,
          "hover:opacity-90 active:scale-95",
        )}
        title={config.label}
        aria-label="Real-time connection status"
      >
        <Icon size={14} className={cn("h-3.5 w-3.5", config.pulse && "animate-spin")} />
        <span className="hidden lg:inline font-mono text-[11px]">{config.label}</span>
      </button>

      {/* Tooltip popover */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 w-72 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl backdrop-blur-md animate-in fade-in-50 slide-in-from-top-1 duration-150"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              {t("liveTelemetry")}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-500 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              28ms
            </span>
          </div>

          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-lg border shrink-0 mt-0.5", config.bg)}>
              <Icon
                size={16}
                className={cn("h-4 w-4", config.color, config.pulse && "animate-spin")}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center justify-between">
                <span>{config.label}</span>
                <span className="text-[10px] font-mono font-normal text-muted-foreground">
                  {t("protocol")}
                </span>
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                {config.desc}
              </p>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-mono">
              {lastGlobalUpdate
                ? t("syncedAt", { time: new Date(lastGlobalUpdate).toLocaleTimeString() })
                : t("heartbeat")}
            </span>
            <button
              onClick={() => {
                triggerRefresh();
                toast.success(t("syncingToast"));
              }}
              className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
            >
              {t("syncNow")}
            </button>
          </div>
        </div>
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
  const confirm = useConfirm();

  // Intentional one-time mount guard to avoid hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  const particleColor = mounted && theme === "dark" ? "#818cf8" : "#6366f1";

  // Opens the command palette the same way the ⌘K shortcut would.
  const openSearch = () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  };

  return (
    <header className="sticky top-0 z-30 h-14 lg:h-16 border-b border-gray-200/70 dark:border-gray-800/50">
      {/* Interactive particle background (clipped to the bar so it doesn't bleed,
          while still letting header dropdowns overflow below) */}
      <div className="absolute inset-0 overflow-hidden">
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
      </div>
      <div className="relative flex items-center justify-between h-full px-3 lg:px-6 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl">
        {/* Mobile menu + Logo */}
        <div className="flex items-center gap-1.5 lg:hidden">
          <button
            onClick={onMenuClick}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 -ml-2"
            aria-label="Toggle menu"
          >
            <MenuIcon size={20} className="h-5 w-5" animateOnHover={false} />
          </button>
          {/* Compact search trigger for phones (<640px) — the pill is hidden there */}
          <button
            onClick={openSearch}
            className="sm:hidden p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={tcommon("search")}
          >
            <SearchIcon size={18} className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* Organization Switcher */}
        <div className="flex items-center">
          <OrganizationSwitcher />
        </div>

        {/* Search / Command Palette Trigger */}
        <div className="flex-1 max-w-[150px] sm:max-w-[190px] md:max-w-[240px] lg:max-w-[280px] hidden sm:block">
          <button onClick={openSearch} className="relative w-full group">
            <div className="flex items-center gap-2 sm:gap-3 h-9 px-3 bg-gray-50 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700/50 rounded-xl cursor-pointer group-hover:border-gray-300 dark:group-hover:border-gray-600 transition-all duration-200 group-hover:shadow-sm">
              <SearchIcon size={16} className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="flex-1 text-left text-sm text-gray-400 truncate">
                {tcommon("search")}
              </span>
              <kbd className="hidden md:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px] font-mono text-gray-400 shadow-sm shrink-0">
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
                aria-label={tsettings("appearance")}
              >
                {mounted && theme === "dark" ? (
                  <MoonIcon size={20} className="h-5 w-5" />
                ) : mounted && theme === "light" ? (
                  <SunIcon size={20} className="h-5 w-5" />
                ) : (
                  <Monitor className="h-5 w-5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>{tsettings("appearance")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[
                { key: "light", icon: SunIcon, label: tsettings("light") },
                { key: "dark", icon: MoonIcon, label: tsettings("dark") },
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
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-gray-700 dark:text-gray-300",
                    )}
                  >
                    <Icon size={16} className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-sm">{label}</span>
                    {isSelected ? (
                      <CheckIcon
                        size={16}
                        className="h-4 w-4 text-primary animate-in zoom-in-50 duration-200"
                      />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Currency Switcher */}
          <CurrencySwitcher />

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
                <Avatar className="h-8 w-8 ring-2 ring-primary/30 dark:ring-primary/40 ring-offset-2 ring-offset-transparent">
                  <AvatarImage
                    src={user?.avatar || (user as any)?.picture || ""}
                    alt={user?.name || ""}
                  />
                  <AvatarFallback className="text-xs avatar-brand font-semibold">
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
                  <UserIcon size={16} className="h-4 w-4 mr-2" /> {tnav("profile")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`/${pathname.split("/")[1]}/settings`}
                  className="flex items-center cursor-pointer"
                >
                  <SettingsIcon size={16} className="h-4 w-4 mr-2" /> {tnav("settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async (e) => {
                  e.preventDefault();
                  const ok = await confirm({
                    title: tnav("logoutConfirmTitle"),
                    description: tnav("logoutConfirmDesc"),
                    confirmLabel: tnav("logout"),
                    destructive: true,
                  });
                  if (ok) logout();
                }}
                className="text-red-600 dark:text-red-400 w-full flex items-center cursor-pointer"
              >
                <LogoutIcon size={16} className="h-4 w-4 mr-2" /> {tnav("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
