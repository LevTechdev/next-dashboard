"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useViewTransition } from "@/components/view-transition-provider";
import {
  Sun,
  Moon,
  Monitor,
  Languages,
  Bell,
  Shield,
  Save,
  TrendingUp,
  AlertTriangle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useRealtime } from "@/components/realtime-provider";
import { toast } from "sonner";

export default function SettingsPage() {
  const tsettings = useTranslations("settings");
  const tcommon = useTranslations("common");
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const { push: pushWithTransition } = useViewTransition();
  const [mounted, setMounted] = useState(false);
  const [locale, setLocale] = useState("en");
  const { budgetThreshold, setBudgetThreshold } = useRealtime();
  const [localThreshold, setLocalThreshold] = useState(budgetThreshold);

  useEffect(() => {
    setMounted(true);
    setLocale(localStorage.getItem("dashboard-locale") || "en");
    setLocalThreshold(budgetThreshold);
  }, [budgetThreshold]);

  const changeLanguage = (lang: string) => {
    if (lang === locale) return;
    setLocale(lang);
    localStorage.setItem("dashboard-locale", lang);
    const newPath = pathname.replace(/^\/[a-z]{2}(?:-\w{2})?/, `/${lang}`);
    pushWithTransition(newPath);
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
              {theme === "dark" ? <Moon className="h-5 w-5" /> : theme === "light" ? <Sun className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
              <CardTitle>{tsettings("appearance")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">{tsettings("general")}</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "light" as const, icon: Sun, label: tsettings("light"), iconColor: "text-orange-500" },
                { key: "dark" as const, icon: Moon, label: tsettings("dark"), iconColor: "text-blue-500" },
                { key: "system" as const, icon: Monitor, label: tsettings("system"), iconColor: "text-gray-500" },
              ].map(({ key, icon: Icon, label, iconColor }) => {
                const isSelected = mounted && theme === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className={cn(
                      "relative p-4 rounded-xl border-2 transition-all duration-200 text-center group",
                      isSelected
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm",
                      "active:scale-[0.97] hover:scale-[1.02]"
                    )}
                  >
                    <Icon className={cn("h-6 w-6 mx-auto mb-2", iconColor)} />
                    <span className={cn(
                      "text-sm font-medium block",
                      isSelected && "text-indigo-600 dark:text-indigo-400"
                    )}>
                      {label}
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2">
                        <Check className="h-4 w-4 text-indigo-500 animate-in zoom-in-50 duration-200" />
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
              <Languages className="h-5 w-5" />
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
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm",
                      "active:scale-[0.97] hover:scale-[1.02]"
                    )}
                  >
                    <span className="text-2xl mb-1 block">{flag}</span>
                    <span className={cn(
                      "text-sm font-medium block",
                      isSelected && "text-indigo-600 dark:text-indigo-400"
                    )}>
                      {label}
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2">
                        <Check className="h-4 w-4 text-indigo-500 animate-in zoom-in-50 duration-200" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>{tsettings("notifications")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div><p className="text-sm font-medium">{tsettings("emailNotifications")}</p><p className="text-xs text-gray-500">{tsettings("emailNotificationsDesc")}</p></div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div><p className="text-sm font-medium">{tsettings("orderUpdates")}</p><p className="text-xs text-gray-500">{tsettings("orderUpdatesDesc")}</p></div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div><p className="text-sm font-medium">{tsettings("marketingAlerts")}</p><p className="text-xs text-gray-500">{tsettings("marketingAlertsDesc")}</p></div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Budget Alert Threshold */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <CardTitle>{tsettings("budgetAlertThreshold")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              {tsettings("budgetAlertDesc")}
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500 font-medium w-16">
                  {localThreshold}%
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
                  {tsettings("budgetAlertMessage", { threshold: localThreshold })}
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
              <div><p className="text-sm font-medium">{tsettings("twoFactorAuth")}</p><p className="text-xs text-gray-500">{tsettings("twoFactorAuthDesc")}</p></div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div><p className="text-sm font-medium">{tsettings("sessionTimeout")}</p><p className="text-xs text-gray-500">{tsettings("sessionTimeoutDesc")}</p></div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" /> {tsettings("saveChanges")}</Button>
      </div>
    </div>
  );
}
