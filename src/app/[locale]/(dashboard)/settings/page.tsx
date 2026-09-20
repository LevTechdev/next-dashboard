"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
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
  Key,
  Globe,
  AlertCircle,
  Download,
  Copy,
  Check,
  Trash2,
  Plus,
  RefreshCw,
  FlaskConical,
  Power,
  PowerOff,
  Pencil,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { cn, formatLocaleNumber } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useThemeReveal } from "@/hooks/use-theme-reveal";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/ui/confirm-provider";
import { Tooltip } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/sora-ui/base/alert-dialog";
import { useRealtime } from "@/components/realtime-provider";
import { restartTour } from "@/components/ui/onboarding-tour";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";
import { DEFAULT_APPEARANCE, useAppearance, type ThemeSwitchKey } from "@/hooks/use-appearance";
import { WhiteLabelBranding } from "@/components/settings/white-label-branding";
import { SchedulerStatusCard } from "@/components/settings/scheduler-status-card";
import { DigestPreviewCard } from "@/components/settings/digest-preview-card";
import { toast } from "sonner";

export default function SettingsPage() {
  const tsettings = useTranslations("settings");
  const tcommon = useTranslations("common");
  const tprofile = useTranslations("profile");
  const { reset: resetOnboarding } = useOnboarding();
  const { theme } = useTheme();
  const { select: selectTheme } = useThemeReveal();
  const pathname = usePathname();
  const router = useRouter();
  const { push: pushWithTransition } = useViewTransition();
  const [mounted, setMounted] = useState(false);
  const [locale, setLocale] = useState("en");
  const { budgetThreshold, setBudgetThreshold } = useRealtime();
  const [localThreshold, setLocalThreshold] = useState(budgetThreshold);
  const { settings: appearance, update: updateAppearance } = useAppearance();
  // Older saved settings predate this field, so fall back to the default.
  const activeThemeSwitch: ThemeSwitchKey =
    appearance.themeSwitch ?? DEFAULT_APPEARANCE.themeSwitch;
  const confirm = useConfirm();
  const { logout } = useAuth();

  // ── Delete Account (Danger Zone) — password-confirmed, mirrors the
  // profile page flow: DELETE /api/profile then hard-redirect home.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error(tcommon("error"));
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || tsettings("deleteAccountConfirm"));
        return;
      }
      toast.success(tprofile("accountDeleted"));
      await logout();
      window.location.href = "/";
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setDeleting(false);
    }
  };

  // -- Notifications --
  const [notifPrefs, setNotifPrefs] = useState<any>(null);

  useEffect(() => {
    fetch("/api/profile/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setNotifPrefs(d);
      });
  }, []);

  const updateNotifPref = async (updates: any) => {
    setNotifPrefs((prev: any) => ({ ...prev, ...updates }));
    try {
      await fetch("/api/profile/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch (e) {
      // ignore
    }
  };

  // ── Two-Factor Authentication state ──
  // Mirrors the profile/security 2FA toggle: ON when TOTP is active, and
  // clicking it routes to the profile page's setup/disable flow.
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { totpEnabled?: boolean }) => {
        if (!cancelled) setTotpEnabled(d?.totpEnabled === true);
      })
      .catch(() => {
        if (!cancelled) setTotpEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── API Keys ──
  interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    permissions: string;
    status: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
  }
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPerms, setNewKeyPerms] = useState("read");
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKeyValue, setCreatedKeyValue] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys");
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data);
      }
    } catch {
      // ignore
    } finally {
      setApiKeysLoading(false);
    }
  }, []);

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName, permissions: newKeyPerms }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || tcommon("error"));
        return;
      }
      const data = await res.json();
      setCreatedKeyValue(data.key);
      setShowCreateKey(false);
      setNewKeyName("");
      setNewKeyPerms("read");
      await fetchApiKeys();
      toast.success(tsettings("apiKeyCopied"));
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    const key = apiKeys.find((k) => k.id === id);
    const newStatus = key?.status === "ACTIVE" ? "REVOKED" : "ACTIVE";
    try {
      const res = await fetch("/api/api-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) {
        toast.error(tcommon("error"));
        return;
      }
      await fetchApiKeys();
      toast.success(
        newStatus === "REVOKED" ? tsettings("apiKeyRevoked") : tsettings("apiKeyCopied"),
      );
    } catch {
      toast.error(tcommon("error"));
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    const ok = await confirm({
      title: tsettings("apiKeyRevoke"),
      description: tsettings("apiKeyRevokeConfirm"),
      confirmLabel: tsettings("apiKeyRevoke"),
      icon: "key",
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch("/api/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        toast.error(tcommon("error"));
        return;
      }
      await fetchApiKeys();
      toast.success(tsettings("apiKeyRevoked"));
    } catch {
      toast.error(tcommon("error"));
    }
  };

  const handleCopyKey = (key: ApiKey) => {
    navigator.clipboard.writeText(key.prefix);
    setCopiedKeyId(key.id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // ── Webhooks ──
  interface WebhookEndpoint {
    id: string;
    name: string;
    url: string;
    subscribedEvents: string[];
    status: string;
    description: string | null;
    lastTriggeredAt: string | null;
    lastStatus: string | null;
    createdAt: string;
    _count: { deliveries: number };
  }
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [editWebhook, setEditWebhook] = useState<WebhookEndpoint | null>(null);
  const [webhookForm, setWebhookForm] = useState({
    name: "",
    url: "",
    description: "",
    events: [] as string[],
  });
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  const EVENT_GROUPS = [
    {
      label: "Orders",
      events: ["order.created", "order.updated", "order.cancelled", "order.refunded"],
    },
    { label: "Customers", events: ["customer.created", "customer.updated"] },
    { label: "Products", events: ["product.created", "product.updated", "product.low_stock"] },
    { label: "Payments", events: ["payment.completed", "payment.failed"] },
  ];

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks");
      if (res.ok) setWebhooks(await res.json());
    } catch {
      /* ignore */
    } finally {
      setWebhooksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
    fetchWebhooks();
  }, []);

  const openCreateWebhook = () => {
    setEditWebhook(null);
    setWebhookForm({ name: "", url: "", description: "", events: [] });
    setShowCreateWebhook(true);
  };
  const openEditWebhook = (wh: WebhookEndpoint) => {
    setEditWebhook(wh);
    setWebhookForm({
      name: wh.name,
      url: wh.url,
      description: wh.description || "",
      events: [...wh.subscribedEvents],
    });
    setShowCreateWebhook(true);
  };

  const handleSaveWebhook = async () => {
    if (!webhookForm.name.trim() || !webhookForm.url.trim()) {
      toast.error(tsettings("webhookSelectEvents"));
      return;
    }
    if (webhookForm.events.length === 0) {
      toast.error(tsettings("webhookSelectEvents"));
      return;
    }
    setSavingWebhook(true);
    try {
      const method = editWebhook ? "PUT" : "POST";
      const body = editWebhook ? { id: editWebhook.id, ...webhookForm } : webhookForm;
      const res = await fetch("/api/webhooks", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || tcommon("error"));
        return;
      }
      await fetchWebhooks();
      setShowCreateWebhook(false);
      toast.success(editWebhook ? tsettings("webhookUpdated") : tsettings("webhookCreated"));
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleToggleWebhook = async (wh: WebhookEndpoint) => {
    const newStatus = wh.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch("/api/webhooks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: wh.id, status: newStatus }),
      });
      if (!res.ok) {
        toast.error(tcommon("error"));
        return;
      }
      await fetchWebhooks();
      toast.success(
        newStatus === "ACTIVE" ? tsettings("webhookActivated") : tsettings("webhookPaused"),
      );
    } catch {
      toast.error(tcommon("error"));
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    const ok = await confirm({
      title: tsettings("webhookDelete"),
      description: tsettings("webhookConfirmDelete"),
      confirmLabel: tcommon("delete"),
      icon: "trash",
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch("/api/webhooks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        toast.error(tcommon("error"));
        return;
      }
      await fetchWebhooks();
      toast.success(tsettings("webhookDeleted"));
    } catch {
      toast.error(tcommon("error"));
    }
  };

  const handleTestWebhook = async (id: string) => {
    setTestingWebhook(id);
    try {
      const res = await fetch("/api/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId: id }),
      });
      const data = await res.json();
      if (data.status === "DELIVERED") {
        toast.success(
          tsettings("webhookTestSuccess", {
            statusCode: data.statusCode,
            durationMs: data.durationMs,
          }),
        );
      } else {
        toast.error(tsettings("webhookTestFailed", { code: data.statusCode || "N/A" }));
      }
      await fetchWebhooks();
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setTestingWebhook(null);
    }
  };

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
                    onClick={(event) => selectTheme(key, { origin: event.currentTarget })}
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

            {/* Replay the guided product tour — language-aware: restarts in
                whichever language the user picks here (or the UI locale). */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <p className="text-sm text-gray-500">{tsettings("tourReplayDesc")}</p>
              <Button
                variant="outline"
                size="sm"
                data-testid="restart-tour"
                className="shrink-0 gap-1.5"
                onClick={() => {
                  // Reset the checklist too, so "replay the tour" restores the
                  // full first-run experience instead of only the spotlight.
                  resetOnboarding();
                  restartTour(locale);
                  toast.success(tsettings("tourReplayToast"));
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {tsettings("tourReplay")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* White-Labeling & Custom Branding */}
        <WhiteLabelBranding />

        {/* Scheduler health — enabled flag + last run per job (admins only). */}
        <SchedulerStatusCard />

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
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
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
                  { key: "custom", label: "Custom", swatch: "bg-gray-400" },
                ] as const
              ).map(({ key, label, swatch }) => {
                const isSelected = appearance.accent === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === "custom" && !appearance.customColor) {
                        updateAppearance({ accent: key, customColor: "#3b82f6" });
                      } else {
                        updateAppearance({ accent: key });
                      }
                    }}
                    className={cn(
                      "relative p-3 rounded-xl border-2 transition-colors duration-200 text-center group cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm",
                      "active:scale-[0.97]",
                    )}
                  >
                    {/* Hover feedback lives on the swatch ICON only — the card
                        and its label stay put, so a row of colors can be
                        scanned without the whole tile jumping under the
                        pointer. */}
                    {key === "custom" && isSelected ? (
                      <input
                        type="color"
                        value={appearance.customColor || "#3b82f6"}
                        onChange={(e) =>
                          updateAppearance({ accent: "custom", customColor: e.target.value })
                        }
                        className="w-6 h-6 p-0 border-0 rounded-full mx-auto mb-1.5 block cursor-pointer transition-transform duration-200 group-hover:scale-110 group-hover:ring-2 group-hover:ring-primary/40"
                      />
                    ) : (
                      <span
                        className={cn(
                          "w-6 h-6 rounded-full mx-auto mb-1.5 block shadow-inner cursor-pointer",
                          "transition-transform duration-200 group-hover:scale-110 group-hover:ring-2 group-hover:ring-primary/40",
                          key === "custom" && appearance.customColor ? "" : swatch,
                        )}
                        style={
                          key === "custom" && appearance.customColor
                            ? { backgroundColor: appearance.customColor }
                            : undefined
                        }
                      />
                    )}
                    <span className="text-[11px] font-medium block truncate">{label}</span>
                    {isSelected && key !== "custom" && (
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

        {/* Theme Switch reveal — the variant is read by use-theme-reveal.ts at
            click time, so the very next toggle uses the new effect. */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <CardTitle>{tsettings("themeSwitch")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">{tsettings("themeSwitchDesc")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(
                [
                  { key: "circle", labelKey: "themeSwitchCircle", shape: "circle" },
                  { key: "circle-blur", labelKey: "themeSwitchCircleBlur", shape: "blur" },
                  { key: "rectangle", labelKey: "themeSwitchRectangle", shape: "frame" },
                  { key: "polygon", labelKey: "themeSwitchPolygon", shape: "diamond" },
                  { key: "none", labelKey: "themeSwitchNone", shape: "plain" },
                ] as const
              ).map(({ key, labelKey, shape }) => {
                const isSelected = activeThemeSwitch === key;
                const label = tsettings(labelKey);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateAppearance({ themeSwitch: key })}
                    aria-pressed={isSelected}
                    className={cn(
                      "relative p-4 rounded-xl border-2 transition-all duration-200 text-center group",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm",
                      "active:scale-[0.97] hover:scale-[1.02]",
                    )}
                  >
                    <span className="mx-auto mb-2 flex h-7 w-7 items-center justify-center">
                      {shape === "circle" && <span className="h-4 w-4 rounded-full bg-primary" />}
                      {shape === "blur" && (
                        <span className="h-4 w-4 rounded-full bg-primary/80 blur-[3px]" />
                      )}
                      {shape === "frame" && (
                        <span className="h-4 w-4 rounded-[4px] border-2 border-primary" />
                      )}
                      {shape === "diamond" && (
                        <span className="h-4 w-4 rotate-45 rounded-[2px] bg-primary/70" />
                      )}
                      {shape === "plain" && (
                        <span className="h-4 w-[3px] rounded-full bg-gray-400 dark:bg-gray-500" />
                      )}
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
                <input
                  type="checkbox"
                  checked={notifPrefs?.emailOnAlert ?? true}
                  onChange={(e) => updateNotifPref({ emailOnAlert: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{tsettings("orderUpdates")}</p>
                <p className="text-xs text-gray-500">{tsettings("orderUpdatesDesc")}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs?.emailOnOrder ?? true}
                  onChange={(e) => updateNotifPref({ emailOnOrder: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{tsettings("marketingAlerts")}</p>
                <p className="text-xs text-gray-500">{tsettings("marketingAlertsDesc")}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs?.emailOnCampaign ?? false}
                  onChange={(e) => updateNotifPref({ emailOnCampaign: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Daily digest — what the cron email will contain, computed live */}
            <DigestPreviewCard />
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
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setLocalThreshold(v);
                    setBudgetThreshold(v);
                    updateNotifPref({ campaignBudgetPercent: v });
                  }}
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-primary"
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
              {/* Reflects the real TOTP state — auto-ON when 2FA is active.
                  Toggling routes to the profile page where setup/disable runs. */}
              <Switch
                checked={totpEnabled === true}
                disabled={totpEnabled === null}
                onCheckedChange={(next) => {
                  if (next) {
                    pushWithTransition(`/${locale}/profile?setup2fa=1#two-factor`);
                  } else {
                    pushWithTransition(`/${locale}/profile?disable2fa=1#two-factor`);
                  }
                }}
                aria-label={tsettings("twoFactorAuth")}
              />
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

        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                <div>
                  <CardTitle>{tsettings("apiKeys")}</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">{tsettings("apiKeysDesc")}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 h-9 px-3.5 text-xs font-semibold"
                onClick={() => setShowCreateKey(true)}
              >
                <Plus className="h-4 w-4" /> {tsettings("apiKeyCreate")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {apiKeysLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 shimmer rounded-lg" />
                ))}
              </div>
            ) : apiKeys.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">{tsettings("apiKeyEmpty")}</p>
            ) : (
              apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                      <Key className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{key.name}</p>
                        <Badge variant={key.status === "ACTIVE" ? "success" : "danger"}>
                          {key.status === "ACTIVE"
                            ? tsettings("webhookActive")
                            : tsettings("webhookInactive")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500 font-mono">{key.prefix}</p>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-400 capitalize">{key.permissions}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 max-sm:self-end">
                    <span className="text-xs text-gray-400 hidden md:inline">
                      {key.lastUsedAt ? key.lastUsedAt : tsettings("apiKeyNeverUsed")}
                    </span>
                    <Tooltip content={tcommon("copyPrefix")} side="top">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 min-w-9 min-h-9 shrink-0 p-0 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        onClick={() => handleCopyKey(key)}
                        aria-label={tcommon("copyPrefix")}
                      >
                        {copiedKeyId === key.id ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </Tooltip>
                    <Tooltip
                      content={
                        key.status === "ACTIVE"
                          ? tsettings("apiKeyRevoke")
                          : tsettings("apiKeyReactivate")
                      }
                      side="top"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-9 w-9 min-w-9 min-h-9 shrink-0 p-0 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
                          key.status === "ACTIVE"
                            ? "text-amber-500 hover:text-amber-600"
                            : "text-emerald-500 hover:text-emerald-600",
                        )}
                        onClick={() => handleRevokeApiKey(key.id)}
                        aria-label={
                          key.status === "ACTIVE"
                            ? tsettings("apiKeyRevoke")
                            : tsettings("apiKeyReactivate")
                        }
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={tsettings("apiKeyRevoke")} side="top">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 min-w-9 min-h-9 shrink-0 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                        onClick={() => handleDeleteApiKey(key.id)}
                        aria-label={tsettings("apiKeyRevoke")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                <div>
                  <CardTitle>{tsettings("webhooks")}</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">{tsettings("webhooksDesc")}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 h-9 px-3.5 text-xs font-semibold"
                onClick={openCreateWebhook}
              >
                <Plus className="h-4 w-4" /> {tsettings("webhookAdd")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {webhooksLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 shimmer rounded-lg" />
                ))}
              </div>
            ) : webhooks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">{tsettings("webhookEmpty")}</p>
            ) : (
              webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "w-2.5 h-2.5 rounded-full shrink-0",
                          wh.status === "ACTIVE"
                            ? "bg-emerald-500 shadow-sm"
                            : "bg-gray-300 dark:bg-gray-600",
                        )}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{wh.name}</p>
                          <Badge variant={wh.status === "ACTIVE" ? "success" : "outline"}>
                            {wh.status === "ACTIVE"
                              ? tsettings("webhookActive")
                              : tsettings("webhookInactive")}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 font-mono truncate">{wh.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 max-sm:self-end">
                      <Tooltip content={tsettings("webhookTest")} side="top">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 min-w-9 min-h-9 shrink-0 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                          onClick={() => handleTestWebhook(wh.id)}
                          disabled={testingWebhook === wh.id}
                          aria-label={tsettings("webhookTest")}
                        >
                          <FlaskConical className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip
                        content={
                          wh.status === "ACTIVE"
                            ? tsettings("webhookPaused")
                            : tsettings("webhookActivated")
                        }
                        side="top"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-9 w-9 min-w-9 min-h-9 shrink-0 p-0 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
                            wh.status === "ACTIVE"
                              ? "text-amber-500 hover:text-amber-600"
                              : "text-emerald-500 hover:text-emerald-600",
                          )}
                          onClick={() => handleToggleWebhook(wh)}
                          aria-label={
                            wh.status === "ACTIVE"
                              ? tsettings("webhookPaused")
                              : tsettings("webhookActivated")
                          }
                        >
                          {wh.status === "ACTIVE" ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                      </Tooltip>
                      <Tooltip content={tcommon("edit")} side="top">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 min-w-9 min-h-9 shrink-0 p-0 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          onClick={() => openEditWebhook(wh)}
                          aria-label={tcommon("edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content={tcommon("delete")} side="top">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 min-w-9 min-h-9 shrink-0 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                          onClick={() => handleDeleteWebhook(wh.id)}
                          aria-label={tcommon("delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 pl-5">
                    <span>{wh.subscribedEvents.length} events</span>
                    <span>•</span>
                    <span>
                      {wh._count.deliveries} {tsettings("webhookDeliveries")?.toLowerCase()}
                    </span>
                    <span>•</span>
                    <span>
                      {wh.lastTriggeredAt
                        ? tsettings("webhookLastTriggered")
                        : tsettings("webhookNeverTriggered")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone — full width outside the grid */}
      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <CardTitle className="text-red-600 dark:text-red-400">
                {tsettings("dangerZone")}
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">{tsettings("dangerZoneDesc")}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm font-medium">{tsettings("exportData")}</p>
                <p className="text-xs text-gray-500">{tsettings("exportDataDesc")}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success(tsettings("dataExported"))}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" /> {tsettings("exportData")}
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10">
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  {tsettings("deleteAccount")}
                </p>
                <p className="text-xs text-gray-500">{tsettings("deleteAccountDesc")}</p>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {tsettings("deleteAccount")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account — password-confirmed destructive action */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>{tsettings("deleteAccount")}</AlertDialogTitle>
            <AlertDialogDescription>{tsettings("deleteAccountConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {tprofile("enterPasswordConfirm")}
            </label>
            <Input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder={tprofile("yourCurrentPassword")}
              className="border-red-300 dark:border-red-700 focus:ring-red-500"
              autoComplete="current-password"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteOpen(false);
                setDeletePassword("");
              }}
            >
              {tcommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={!deletePassword || deleting}
            >
              {deleting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> {tprofile("deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" /> {tsettings("deleteAccount")}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Created API Key Reveal */}
      {createdKeyValue && (
        <Card className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    API Key Created
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Copy this key now. It won&apos;t be shown again.
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCreatedKeyValue(null)}>
                ×
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 p-2 bg-white dark:bg-gray-800 rounded text-xs font-mono break-all border">
                {createdKeyValue}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(createdKeyValue);
                  toast.success(tsettings("apiKeyCopied"));
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create API Key Dialog */}
      <Dialog open={showCreateKey} onOpenChange={setShowCreateKey}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tsettings("apiKeyCreate")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder={tsettings("apiKeyName")}
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <Select value={newKeyPerms} onValueChange={setNewKeyPerms}>
              <SelectTrigger>
                <SelectValue placeholder="Permissions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="readwrite">Read & Write</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleCreateApiKey}
              disabled={creatingKey || !newKeyName.trim()}
              className="w-full"
            >
              {creatingKey ? "Creating..." : tsettings("apiKeyCreate")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Webhook Dialog */}
      <Dialog open={showCreateWebhook} onOpenChange={setShowCreateWebhook}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editWebhook ? tsettings("webhookEdit") : tsettings("webhookAdd")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{tsettings("webhookName")}</label>
              <Input
                placeholder={tsettings("webhookNamePlaceholder")}
                value={webhookForm.name}
                onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{tsettings("webhookUrl")}</label>
              <Input
                placeholder={tsettings("webhookUrlPlaceholder")}
                value={webhookForm.url}
                onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {tsettings("webhookDescLabel")}
              </label>
              <Input
                placeholder={tsettings("webhookDescPlaceholder")}
                value={webhookForm.description}
                onChange={(e) => setWebhookForm({ ...webhookForm, description: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                {tsettings("webhookSubscribeEvents")}
              </label>
              <div className="space-y-3">
                {EVENT_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.events.map((ev) => {
                        const selected = webhookForm.events.includes(ev);
                        return (
                          <button
                            key={ev}
                            type="button"
                            onClick={() => {
                              setWebhookForm({
                                ...webhookForm,
                                events: selected
                                  ? webhookForm.events.filter((e) => e !== ev)
                                  : [...webhookForm.events, ev],
                              });
                            }}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                              selected
                                ? "bg-primary/10 border-primary/40 text-primary"
                                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300",
                            )}
                          >
                            {ev}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {webhookForm.events.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">{tsettings("webhookSelectEvents")}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateWebhook(false)}>
              {tcommon("cancel")}
            </Button>
            <Button onClick={handleSaveWebhook} disabled={savingWebhook}>
              {savingWebhook
                ? "..."
                : editWebhook
                  ? tsettings("webhookUpdate")
                  : tsettings("webhookAdd")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" /> {tsettings("saveChanges")}
        </Button>
      </div>
    </div>
  );
}
