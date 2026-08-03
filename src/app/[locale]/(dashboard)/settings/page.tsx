"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useViewTransition } from "@/components/view-transition-provider";
import { setLocaleCookie } from "@/lib/locale-cookie";
import {
  BellIcon,
  CheckIcon,
  SunIcon,
  MoonIcon,
  LanguagesIcon,
  TrendingUpIcon,
  LayoutGridIcon,
} from "lucide-animated";
import {
  Monitor,
  Shield,
  Save,
  AlertTriangle,
  Palette,
  Type,
  AlignVerticalSpaceAround,
} from "lucide-react";

import { cn, formatLocaleNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useRealtime } from "@/components/realtime-provider";
import { useAppearance } from "@/hooks/use-appearance";
import { toast } from "sonner";

export default function SettingsPage() {
  const tsettings = useTranslations("settings");
  const tcommon = useTranslations("common");
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { push: pushWithTransition } = useViewTransition();
  const [mounted, setMounted] = useState(false);
  const [locale, setLocale] = useState("en");
  const { budgetThreshold, setBudgetThreshold } = useRealtime();
  const [localThreshold, setLocalThreshold] = useState(budgetThreshold);
  const { settings: appearance, update: updateAppearance } = useAppearance();

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
    setLocale(localStorage.getItem("dashboard-locale") || "en");
    setLocalThreshold(budgetThreshold);
  }, [budgetThreshold]);

  const changeLanguage = (lang: string) => {
    if (lang === locale) return;
    setLocale(lang);
    localStorage.setItem("dashboard-locale", lang);
    // Persist for next-intl middleware and refresh server components
    setLocaleCookie(lang);
    const newPath = pathname.replace(/^\/[a-z]{2}(?:-\w{2})?/, `/${lang}`);
    pushWithTransition(newPath);
    router.refresh();
  };

  const handleSave = () => {
    setBudgetThreshold(localThreshold);
    toast.success("Settings saved successfully");
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tsettings("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{tsettings("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {theme === "dark" ? (
                <MoonIcon size={20} className="h-5 w-5" />
              ) : theme === "light" ? (
                <SunIcon size={20} className="h-5 w-5" />
              ) : (
                <Monitor className="h-5 w-5" />
              )}
              <CardTitle>{tsettings("appearance")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">{tsettings("general")}</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  key: "light" as const,
                  icon: SunIcon,
                  label: tsettings("light"),
                  iconColor: "text-orange-500",
                },
                {
                  key: "dark" as const,
                  icon: MoonIcon,
                  label: tsettings("dark"),
                  iconColor: "text-blue-500",
                },
                {
                  key: "system" as const,
                  icon: Monitor,
                  label: tsettings("system"),
                  iconColor: "text-gray-500",
                },
              ].map(({ key, icon: Icon, label, iconColor }) => {
                const isSelected = mounted && theme === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className={cn(
                      "relative p-4 rounded-xl border-2 transition-all duration-200 text-center group",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm",
                      "active:scale-[0.97] hover:scale-[1.02]",
                    )}
                  >
                    <Icon size={24} className={cn("h-6 w-6 mx-auto mb-2", iconColor)} />
                    <span className={cn("text-sm font-medium block", isSelected && "text-primary")}>
                      {label}
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2">
                        <CheckIcon
                          size={16}
                          className="h-4 w-4 text-primary animate-in zoom-in-50 duration-200"
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LanguagesIcon size={20} className="h-5 w-5" />
              <CardTitle>{tsettings("language")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">{tsettings("general")}</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "en", flag: "🇬🇧", label: tsettings("langEn") },
                { key: "id", flag: "🇮🇩", label: tsettings("langId") },
                { key: "zh", flag: "🇨🇳", label: tsettings("langZh") },
                { key: "ja", flag: "🇯🇵", label: tsettings("langJa") },
              ].map(({ key, flag, label }) => {
                const isSelected = locale === key;
                return (
                  <button
                    key={key}
                    onClick={() => changeLanguage(key)}
                    className={cn(
                      "relative p-4 rounded-xl border-2 transition-all duration-200 text-center group",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm",
                      "active:scale-[0.97] hover:scale-[1.02]",
                    )}
                  >
                    <span className="text-2xl mb-1 block">{flag}</span>
                    <span className={cn("text-sm font-medium block", isSelected && "text-primary")}>
                      {label}
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2">
                        <CheckIcon
                          size={16}
                          className="h-4 w-4 text-primary animate-in zoom-in-50 duration-200"
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Accent Color */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              <CardTitle>{tsettings("accentColor")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">{tsettings("accentColorDesc")}</p>
            <div className="grid grid-cols-5 gap-3">
              {(
                [
                  {
                    key: "default",
                    label: tsettings("accentDefault"),
                    swatch: "bg-[hsl(73_100%_44%)] dark:bg-[hsl(265_77%_66%)]",
                  },
                  {
                    key: "green",
                    label: tsettings("accentGreen"),
                    swatch: "bg-[oklch(0.78_0.22_147.35)]",
                  },
                  { key: "indigo", label: tsettings("accentIndigo"), swatch: "bg-indigo-500" },
                  { key: "rose", label: tsettings("accentRose"), swatch: "bg-rose-500" },
                  { key: "amber", label: tsettings("accentAmber"), swatch: "bg-amber-500" },
                ] as const
              ).map(({ key, label, swatch }) => {
                const isSelected = appearance.accent === key;
                return (
                  <button
                    key={key}
                    onClick={() => updateAppearance({ accent: key })}
                    className={cn(
                      "relative p-3 rounded-xl border-2 transition-all duration-200 text-center group",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm",
                      "active:scale-[0.97] hover:scale-[1.02]",
                    )}
                  >
                    <span
                      className={cn(
                        "w-6 h-6 rounded-full mx-auto mb-1.5 block shadow-inner",
                        swatch,
                      )}
                    />
                    <span className="text-[11px] font-medium block truncate">{label}</span>
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5">
                        <CheckIcon
                          size={14}
                          className="h-3.5 w-3.5 text-primary animate-in zoom-in-50 duration-200"
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Text Size */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              <CardTitle>{tsettings("textSize")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">{tsettings("textSizeDesc")}</p>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { key: "sm", label: tsettings("textSmall"), sample: "text-xs" },
                  { key: "base", label: tsettings("textRegular"), sample: "text-sm" },
                  { key: "lg", label: tsettings("textLarge"), sample: "text-base" },
                ] as const
              ).map(({ key, label, sample }) => {
                const isSelected = appearance.textSize === key;
                return (
                  <button
                    key={key}
                    onClick={() => updateAppearance({ textSize: key })}
                    className={cn(
                      "relative p-4 rounded-xl border-2 transition-all duration-200 text-center group",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm",
                      "active:scale-[0.97] hover:scale-[1.02]",
                    )}
                  >
                    <span className={cn("font-bold block mb-1", sample)}>Aa</span>
                    <span className={cn("text-sm font-medium block", isSelected && "text-primary")}>
                      {label}
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2">
                        <CheckIcon
                          size={16}
                          className="h-4 w-4 text-primary animate-in zoom-in-50 duration-200"
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Spacing / Density */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlignVerticalSpaceAround className="h-5 w-5" />
              <CardTitle>{tsettings("density")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">{tsettings("densityDesc")}</p>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { key: "compact", label: tsettings("densityCompact"), bars: "gap-0.5" },
                  { key: "regular", label: tsettings("densityRegular"), bars: "gap-1" },
                  { key: "large", label: tsettings("densityLarge"), bars: "gap-2" },
                ] as const
              ).map(({ key, label, bars }) => {
                const isSelected = appearance.density === key;
                return (
                  <button
                    key={key}
                    onClick={() => updateAppearance({ density: key })}
                    className={cn(
                      "relative p-4 rounded-xl border-2 transition-all duration-200 text-center group",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm",
                      "active:scale-[0.97] hover:scale-[1.02]",
                    )}
                  >
                    <span className={cn("flex flex-col items-center mb-2", bars)}>
                      <span className="w-8 h-1 rounded-full bg-gray-400 dark:bg-gray-500" />
                      <span className="w-8 h-1 rounded-full bg-gray-400 dark:bg-gray-500" />
                      <span className="w-8 h-1 rounded-full bg-gray-400 dark:bg-gray-500" />
                    </span>
                    <span className={cn("text-sm font-medium block", isSelected && "text-primary")}>
                      {label}
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2">
                        <CheckIcon
                          size={16}
                          className="h-4 w-4 text-primary animate-in zoom-in-50 duration-200"
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Widgets */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LayoutGridIcon size={20} className="h-5 w-5" />
              <CardTitle>{tsettings("widgets")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-500 pb-2">{tsettings("widgetsDesc")}</p>
            {(
              [
                { key: "quickActions", label: tsettings("widgetQuickActions") },
                { key: "revenueChart", label: tsettings("widgetRevenueChart") },
                { key: "salesByChannel", label: tsettings("widgetSalesChannel") },
                { key: "recentOrders", label: tsettings("widgetRecentOrders") },
                { key: "topProducts", label: tsettings("widgetTopProducts") },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-1.5">
                <p className="text-sm font-medium">{label}</p>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={appearance.widgets[key]}
                    onChange={(e) =>
                      updateAppearance({
                        widgets: { ...appearance.widgets, [key]: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BellIcon size={20} className="h-5 w-5" />
              <CardTitle>{tsettings("notifications")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{tsettings("emailNotifications")}</p>
                <p className="text-xs text-gray-500">{tsettings("emailNotificationsDesc")}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{tsettings("orderUpdates")}</p>
                <p className="text-xs text-gray-500">{tsettings("orderUpdatesDesc")}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{tsettings("marketingAlerts")}</p>
                <p className="text-xs text-gray-500">{tsettings("marketingAlertsDesc")}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Budget Alert Threshold */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUpIcon size={20} className="h-5 w-5" />
              <CardTitle>{tsettings("budgetAlertThreshold")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">{tsettings("budgetAlertDesc")}</p>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500 font-medium w-16">
                  {formatLocaleNumber(localThreshold, locale)}%
                </span>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={localThreshold}
                  onChange={(e) => setLocalThreshold(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 px-1">
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span>
                  {tsettings("budgetAlertMessage", {
                    threshold: formatLocaleNumber(localThreshold, locale),
                  })}
                  {localThreshold < 70
                    ? tsettings("budgetAlertLow")
                    : localThreshold > 90
                      ? tsettings("budgetAlertHigh")
                      : tsettings("budgetAlertBalanced")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>{tsettings("security")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{tsettings("twoFactorAuth")}</p>
                <p className="text-xs text-gray-500">{tsettings("twoFactorAuthDesc")}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{tsettings("sessionTimeout")}</p>
                <p className="text-xs text-gray-500">{tsettings("sessionTimeoutDesc")}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" /> {tsettings("saveChanges")}
        </Button>
      </div>
    </div>
  );
}
