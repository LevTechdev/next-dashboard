"use client";

import {
  WifiIcon,
  CheckIcon,
  SearchIcon,
  LogoutIcon,
  UserIcon,
  SettingsIcon,
  MenuIcon,
} from "lucide-animated";
import {
  Monitor,
  Command,
  WifiOff,
  Loader2,
  CreditCard,
  Bell,
  KeyRound,
  Shield,
  // The theme trio uses the plain, static glyphs. The animated set draws its
  // own sun rays and moon craters, which read as decoration at 14px next to the
  // flat Monitor icon — the trio should look like one control, not three styles.
  Sun,
  Moon,
} from "lucide-react";
import { Particles } from "@/components/ui/particles";
import { useTheme } from "next-themes";
import { useThemeReveal } from "@/hooks/use-theme-reveal";
import { useState, useEffect, useRef, useCallback } from "react";
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
  const { theme } = useTheme();
  const { select: selectTheme } = useThemeReveal();
  const pathname = usePathname();
  const { unreadCount } = useRealtime();
  const locale = pathname.split("/")[1] || "en";
  const [mounted, setMounted] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  // Navigation links inside the user dropdown must close the menu so the
  // destination page is revealed cleanly (previously the menu stayed open).
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);
  // Theme switches made from this menu reveal FROM the pressed button (see
  // use-theme-reveal.ts). The menu closes first so the switch is judged on the
  // page behind it instead of on a frozen open panel.
  const chooseTheme = useCallback(
    (next: string, origin: Element | null) => {
      setUserMenuOpen(false);
      selectTheme(next, { origin: origin ?? "center" });
    },
    [selectTheme],
  );
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
        {/* Left Side: Mobile Menu + Organization Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 mr-2 sm:mr-6">
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
        </div>

        {/* Center: Search / Command Palette Trigger (Centered with generous spacing) */}
        <div className="flex-1 flex justify-center items-center px-2 sm:px-6">
          <div className="tour-search-bar w-full max-w-[220px] sm:max-w-[280px] md:max-w-[360px] lg:max-w-[440px] hidden sm:block">
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
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {/* Real-time Connection Status */}
          <RealtimeConnectionBadge />

          {/* Theme toggle lives in the avatar dropdown → Appearance submenu */}

          {/* Currency Switcher */}
          <div className="hidden lg:block">
            <CurrencySwitcher />
          </div>

          {/* Language Toggle */}
          <div className="hidden lg:block">
            <LanguageToggle locale={pathname.split("/")[1] || "en"} pathname={pathname} />
          </div>

          {/* Notifications — the standalone bell is desktop-only (lg+); on
              tablet & mobile the avatar dropdown's Notifications item fires
              dashboard:open-notifications, which opens this same panel. The
              trigger button is hidden below lg via the panel's own responsive
              class so the OPENED panel (absolute-positioned) still shows. */}
          <NotificationPanel />

          {/* Command Palette (rendered outside the header) */}
          <CommandPalette />

          {/* User Menu */}
          {/* Controlled open state: clicking a nav item closes the menu before
              the router navigates (Radix keeps it open otherwise, leaving the
              menu rendered over the destination page). */}
          <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
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
            <DropdownMenuContent
              align="end"
              className="w-64 rounded-[26px] p-2 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] outline-none space-y-0.5"
            >
              {/* User summary header */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] mb-1">
                <Avatar className="h-8 w-8 ring-1 ring-black/5 dark:ring-white/10">
                  <AvatarImage
                    src={user?.avatar || (user as any)?.picture || ""}
                    alt={user?.name || ""}
                  />
                  <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {user?.name || "User"}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">{user?.email}</span>
                </div>
              </div>

              {/* 1. Profile */}
              <DropdownMenuItem asChild>
                <Link
                  href={`/${locale}/profile`}
                  onClick={closeUserMenu}
                  className="flex items-center gap-3 px-3 py-2 rounded-2xl cursor-pointer text-sm font-medium transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] focus:bg-black/[0.05] dark:focus:bg-white/[0.08]"
                >
                  <UserIcon size={16} className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1">{tnav("profile")}</span>
                </Link>
              </DropdownMenuItem>

              {/* 2. Security */}
              <DropdownMenuItem asChild>
                <Link
                  href={`/${locale}/security`}
                  onClick={closeUserMenu}
                  className="flex items-center gap-3 px-3 py-2 rounded-2xl cursor-pointer text-sm font-medium transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] focus:bg-black/[0.05] dark:focus:bg-white/[0.08]"
                >
                  <Shield size={16} className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1">{tnav("security")}</span>
                </Link>
              </DropdownMenuItem>

              {/* 3. Notifications */}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent("dashboard:open-notifications"));
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-2xl cursor-pointer text-sm font-medium transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] focus:bg-black/[0.05] dark:focus:bg-white/[0.08]"
              >
                <Bell size={16} className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1">{tnav("notifications")}</span>
                {mounted && unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </DropdownMenuItem>

              {/* 4. Billings */}
              <DropdownMenuItem asChild>
                <Link
                  href={`/${locale}/billing`}
                  onClick={closeUserMenu}
                  className="flex items-center gap-3 px-3 py-2 rounded-2xl cursor-pointer text-sm font-medium transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] focus:bg-black/[0.05] dark:focus:bg-white/[0.08]"
                >
                  <CreditCard size={16} className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1">{tnav("billing")}</span>
                </Link>
              </DropdownMenuItem>

              {/* 5. Api Keys */}
              <DropdownMenuItem asChild>
                <Link
                  href={`/${locale}/api-docs`}
                  onClick={closeUserMenu}
                  className="flex items-center gap-3 px-3 py-2 rounded-2xl cursor-pointer text-sm font-medium transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] focus:bg-black/[0.05] dark:focus:bg-white/[0.08]"
                >
                  <KeyRound size={16} className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1">{tnav("apiKeys")}</span>
                </Link>
              </DropdownMenuItem>

              {/* 6. Settings */}
              <DropdownMenuItem asChild>
                <Link
                  href={`/${locale}/settings`}
                  onClick={closeUserMenu}
                  className="flex items-center gap-3 px-3 py-2 rounded-2xl cursor-pointer text-sm font-medium transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] focus:bg-black/[0.05] dark:focus:bg-white/[0.08]"
                >
                  <SettingsIcon size={16} className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1">{tnav("settings")}</span>
                </Link>
              </DropdownMenuItem>

              {/* 7. Theme toggle */}
              <div className="my-1.5 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03]">
                <span className="flex-1 text-xs text-muted-foreground">
                  {tsettings("theme") || "Theme"}
                </span>
                <div className="flex items-center gap-1 p-0.5 rounded-xl bg-black/5 dark:bg-white/10 shrink-0">
                  <button
                    onClick={(event) => chooseTheme("light", event.currentTarget)}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer",
                      mounted && theme === "light"
                        ? "bg-white dark:bg-zinc-800 text-amber-500 shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-label={tsettings("light")}
                  >
                    <Sun size={14} className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(event) => chooseTheme("dark", event.currentTarget)}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer",
                      mounted && theme === "dark"
                        ? "bg-white dark:bg-zinc-800 text-sky-400 shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-label={tsettings("dark")}
                  >
                    <Moon size={14} className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(event) => chooseTheme("system", event.currentTarget)}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer",
                      mounted && theme === "system"
                        ? "bg-white dark:bg-zinc-800 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-label={tsettings("system")}
                  >
                    <Monitor size={14} className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* 8. Log out */}
              <div className="my-1.5 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
              <DropdownMenuItem
                onSelect={async (e) => {
                  e.preventDefault();
                  setUserMenuOpen(false);
                  const ok = await confirm({
                    title: tnav("logoutConfirmTitle"),
                    description: tnav("logoutConfirmDesc"),
                    confirmLabel: tnav("logout"),
                    destructive: true,
                  });
                  if (ok) logout();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-2xl cursor-pointer text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 transition-colors"
              >
                <LogoutIcon size={16} className="h-4 w-4 shrink-0" />
                <span className="flex-1">{tnav("logout")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
