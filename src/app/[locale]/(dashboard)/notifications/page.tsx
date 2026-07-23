"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  Trash2,
  Mail,
  Settings2,
  Loader2,
  AlertTriangle,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  X,
  Save,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ──────────────────────────────────────────────────────────────────

interface NotificationItem {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  description: string | null;
  link: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  typeCounts: Record<string, { total: number; unread: number }>;
}

interface NotificationPreferences {
  id: string;
  emailOnOrder: boolean;
  emailOnCustomer: boolean;
  emailOnProduct: boolean;
  emailOnRevenue: boolean;
  emailOnInventory: boolean;
  emailOnDiscount: boolean;
  emailOnCampaign: boolean;
  emailOnAlert: boolean;
  lowStockThreshold: number;
  pendingOrderThreshold: number;
  campaignBudgetPercent: number;
  inAppOnOrder: boolean;
  inAppOnCustomer: boolean;
  inAppOnProduct: boolean;
  inAppOnRevenue: boolean;
  inAppOnInventory: boolean;
  inAppOnDiscount: boolean;
  inAppOnCampaign: boolean;
  inAppOnAlert: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const NOTIFICATION_TYPES = [
  "order",
  "customer",
  "product",
  "revenue",
  "inventory",
  "discount",
  "campaign",
  "milestone",
  "alert",
] as const;

const TYPE_ICONS: Record<string, string> = {
  order: "🛒",
  customer: "👤",
  product: "📦",
  revenue: "💰",
  inventory: "⚠️",
  discount: "⏰",
  campaign: "📢",
  milestone: "🎉",
  alert: "🔔",
};

function formatDate(dateStr: string | null, t: (key: string, params?: any) => string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return t("justNow");
  if (mins < 60) return t("minsAgo", { count: mins });
  if (hrs < 24) return t("hoursAgo", { count: hrs });
  if (days < 7) return t("daysAgo", { count: days });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const tsettings = useTranslations("settings");
  const tcommon = useTranslations("common");
  const tnotif = useTranslations("notifications");
  const [activeTab, setActiveTab] = useState("inbox");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tnotif("title")}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {tsettings("notifications")}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inbox" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            {tnotif("tabInbox")}
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {tnotif("tabRules")}
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {tnotif("tabEmail")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-6">
          <InboxTab />
        </TabsContent>
        <TabsContent value="rules" className="mt-6">
          <AlertRulesTab />
        </TabsContent>
        <TabsContent value="email" className="mt-6">
          <EmailPrefsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Inbox Tab ──────────────────────────────────────────────────────────────

function InboxTab() {
  const tnotif = useTranslations("notifications");
  const tcommon = useTranslations("common");
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterRead, setFilterRead] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (filterRead === "unread") params.set("read", "false");
      if (filterRead === "read") params.set("read", "true");
      params.set("limit", "100");
      const res = await fetch(`/api/notifications?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterType, filterRead]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    const res = await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "mark-read" }),
    });
    if (res.ok) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n,
          ),
          unreadCount: prev.unreadCount - 1,
        };
      });
    }
  };

  const handleMarkUnread = async (id: string) => {
    const res = await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "mark-unread" }),
    });
    if (res.ok) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.id === id ? { ...n, read: false, readAt: null } : n,
          ),
          unreadCount: prev.unreadCount + 1,
        };
      });
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setData((prev) => {
        if (!prev) return prev;
        const notif = prev.notifications.find((n) => n.id === id);
        return {
          ...prev,
          notifications: prev.notifications.filter((n) => n.id !== id),
          unreadCount: notif && !notif.read ? prev.unreadCount - 1 : prev.unreadCount,
        };
      });
    }
  };

  const handleBatchMarkRead = async () => {
    if (selectedIds.size === 0) return;
    const res = await fetch("/api/notifications/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-read", ids: Array.from(selectedIds) }),
    });
    if (res.ok) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notifications: prev.notifications.map((n) =>
            selectedIds.has(n.id) ? { ...n, read: true, readAt: new Date().toISOString() } : n,
          ),
          unreadCount: Math.max(0, prev.unreadCount - selectedIds.size),
        };
      });
      toast.success(tnotif("markedAsReadToast", { count: selectedIds.size }));
      setSelectedIds(new Set());
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(tnotif("deleteConfirmToast", { count: selectedIds.size }))) return;
    const idsToDelete = Array.from(selectedIds);
    const res = await fetch("/api/notifications/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: idsToDelete }),
    });
    if (res.ok) {
      const deletedUnreadCount = idsToDelete.filter((id) => {
        const n = data?.notifications.find((x) => x.id === id);
        return n && !n.read;
      }).length;
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notifications: prev.notifications.filter((n) => !idsToDelete.includes(n.id)),
          unreadCount: prev.unreadCount - deletedUnreadCount,
        };
      });
      toast.success(tnotif("deletedToast", { count: idsToDelete.length }));
      setSelectedIds(new Set());
    }
  };

  const handleMarkAllRead = async () => {
    const res = await fetch("/api/notifications/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-all-read" }),
    });
    if (res.ok) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notifications: prev.notifications.map((n) => ({
            ...n,
            read: true,
            readAt: new Date().toISOString(),
          })),
          unreadCount: 0,
        };
      });
      toast.success(tnotif("allReadToast"));
    }
  };

  const handleDeleteAllRead = async () => {
    const res = await fetch("/api/notifications/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-all-read" }),
    });
    if (res.ok) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notifications: prev.notifications.filter((n) => !n.read),
        };
      });
      toast.success(tnotif("readClearedToast"));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = data?.notifications.map((n) => n.id) || [];
    if (selectedIds.size === allIds.length && allIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const notifications = data?.notifications || [];

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">{tnotif("filterAllTypes")}</option>
              {NOTIFICATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {tnotif(`type${t.charAt(0).toUpperCase() + t.slice(1)}`)} (
                  {data?.typeCounts[t]?.unread || 0})
                </option>
              ))}
            </select>
          </div>
          <select
            value={filterRead}
            onChange={(e) => setFilterRead(e.target.value)}
            className="text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{tnotif("filterAllStatus")}</option>
            <option value="unread">{tnotif("filterUnread")}</option>
            <option value="read">{tnotif("filterRead")}</option>
          </select>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={fetchNotifications} title={tcommon("refresh")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {data && data.unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="text-xs gap-1">
              <CheckCheck className="h-4 w-4" /> {tnotif("markAllRead")}
            </Button>
          )}
          {notifications.filter((n) => n.read).length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteAllRead}
              className="text-xs gap-1 text-red-500"
            >
              <Trash2 className="h-4 w-4" /> {tnotif("clearRead")}
            </Button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Summary */}
          {data && (
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>
                <strong className="text-gray-900 dark:text-gray-100">{notifications.length}</strong>{" "}
                {tnotif("notifCount")}
              </span>
              <span>
                <strong className="text-indigo-600 dark:text-indigo-400">{data.unreadCount}</strong>{" "}
                {tnotif("unreadCountLabel")}
              </span>
              {selectedIds.size > 0 && (
                <span className="flex items-center gap-2 ml-auto">
                  <strong>{selectedIds.size}</strong> {tnotif("selectedCount")}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={handleBatchMarkRead}
                  >
                    <CheckCheck className="h-3 w-3 mr-1" /> {tnotif("markReadBtn")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-red-500"
                    onClick={handleBatchDelete}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> {tnotif("deleteBtn")}
                  </Button>
                </span>
              )}
            </div>
          )}

          {/* Notifications List */}
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Bell className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">
                  {tnotif("noNotifications")}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {filterType !== "all" || filterRead !== "all"
                    ? tnotif("tryChangingFilters")
                    : tnotif("allCaughtUp")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* Select All */}
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  checked={selectedIds.size === notifications.length && notifications.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-gray-500">{tnotif("selectAll")}</span>
              </div>

              {notifications.map((n) => (
                <Card
                  key={n.id}
                  className={cn(
                    "transition-all duration-150",
                    !n.read &&
                      "border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/10",
                    selectedIds.has(n.id) && "ring-2 ring-indigo-400",
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center pt-0.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(n.id)}
                          onChange={() => toggleSelect(n.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </div>
                      <span className="text-lg shrink-0 pt-0.5">{TYPE_ICONS[n.type] || "🔔"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4
                            className={cn(
                              "text-sm",
                              !n.read
                                ? "font-semibold"
                                : "font-medium text-gray-600 dark:text-gray-400",
                            )}
                          >
                            {n.title}
                          </h4>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                            {tnotif(`type${n.type.charAt(0).toUpperCase() + n.type.slice(1)}`)}
                          </Badge>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                        </div>
                        {n.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {n.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-gray-400">
                            {formatDate(n.createdAt, tnotif)}
                          </span>
                          {n.link && (
                            <a
                              href={n.link}
                              className="text-[10px] text-indigo-500 hover:underline"
                            >
                              {tnotif("viewDetails")}
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {n.read ? (
                          <button
                            onClick={() => handleMarkUnread(n.id)}
                            className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                            title={tnotif("markAsUnread")}
                          >
                            <BellRing className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                            title={tnotif("markAsRead")}
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(n.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title={tnotif("deleteTitle")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Toggle Component ───────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
      </label>
    </div>
  );
}

// ─── Alert Rules Tab ────────────────────────────────────────────────────────

function AlertRulesTab() {
  const tnotif = useTranslations("notifications");
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localLowStock, setLocalLowStock] = useState(10);
  const [localPendingThreshold, setLocalPendingThreshold] = useState(5);
  const [localBudgetPercent, setLocalBudgetPercent] = useState(80);

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/preferences");
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          setPrefs(data.preferences);
          setLocalLowStock(data.preferences.lowStockThreshold);
          setLocalPendingThreshold(data.preferences.pendingOrderThreshold);
          setLocalBudgetPercent(data.preferences.campaignBudgetPercent);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const updatePref = async (field: string, value: boolean | number) => {
    const res = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      const data = await res.json();
      setPrefs(data);
    }
  };

  const handleSaveThresholds = async () => {
    setSaving(true);
    await updatePref("lowStockThreshold", localLowStock);
    await updatePref("pendingOrderThreshold", localPendingThreshold);
    await updatePref("campaignBudgetPercent", localBudgetPercent);
    setSaving(false);
    toast.success(tnotif("savedToast"));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* In-App Notification Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>{tnotif("rulesInAppTitle")}</CardTitle>
          <CardDescription>{tnotif("rulesInAppDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100 dark:divide-gray-800">
          <Toggle
            checked={prefs?.inAppOnOrder ?? true}
            onChange={(v) => updatePref("inAppOnOrder", v)}
            label={tnotif("toggleInappOrders")}
            description={tnotif("toggleInappOrdersDesc")}
          />
          <Toggle
            checked={prefs?.inAppOnCustomer ?? true}
            onChange={(v) => updatePref("inAppOnCustomer", v)}
            label={tnotif("toggleInappCustomers")}
            description={tnotif("toggleInappCustomersDesc")}
          />
          <Toggle
            checked={prefs?.inAppOnProduct ?? true}
            onChange={(v) => updatePref("inAppOnProduct", v)}
            label={tnotif("toggleInappProducts")}
            description={tnotif("toggleInappProductsDesc")}
          />
          <Toggle
            checked={prefs?.inAppOnInventory ?? true}
            onChange={(v) => updatePref("inAppOnInventory", v)}
            label={tnotif("toggleInappInv")}
            description={tnotif("toggleInappInvDesc")}
          />
          <Toggle
            checked={prefs?.inAppOnDiscount ?? true}
            onChange={(v) => updatePref("inAppOnDiscount", v)}
            label={tnotif("toggleInappDisc")}
            description={tnotif("toggleInappDiscDesc")}
          />
          <Toggle
            checked={prefs?.inAppOnCampaign ?? true}
            onChange={(v) => updatePref("inAppOnCampaign", v)}
            label={tnotif("toggleInappCamp")}
            description={tnotif("toggleInappCampDesc")}
          />
          <Toggle
            checked={prefs?.inAppOnRevenue ?? true}
            onChange={(v) => updatePref("inAppOnRevenue", v)}
            label={tnotif("toggleInappRev")}
            description={tnotif("toggleInappRevDesc")}
          />
          <Toggle
            checked={prefs?.inAppOnAlert ?? true}
            onChange={(v) => updatePref("inAppOnAlert", v)}
            label={tnotif("toggleInappAlert")}
            description={tnotif("toggleInappAlertDesc")}
          />
        </CardContent>
      </Card>

      {/* Threshold Rules */}
      <Card>
        <CardHeader>
          <CardTitle>{tnotif("rulesThresholdsTitle")}</CardTitle>
          <CardDescription>{tnotif("rulesThresholdsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">{tnotif("threshStockLabel")}</label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {localLowStock} units
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="50"
              step="1"
              value={localLowStock}
              onChange={(e) => setLocalLowStock(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[11px] text-gray-400 mt-1">
              <span>3</span>
              <span>25</span>
              <span>50</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{tnotif("threshStockDesc")}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">{tnotif("threshPendingLabel")}</label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {localPendingThreshold} orders
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={localPendingThreshold}
              onChange={(e) => setLocalPendingThreshold(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[11px] text-gray-400 mt-1">
              <span>1</span>
              <span>10</span>
              <span>20</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{tnotif("threshPendingDesc")}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">{tnotif("threshBudgetLabel")}</label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {localBudgetPercent}%
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={localBudgetPercent}
              onChange={(e) => setLocalBudgetPercent(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[11px] text-gray-400 mt-1">
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{tnotif("threshBudgetDesc")}</p>
          </div>

          <Button onClick={handleSaveThresholds} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {tnotif("savingBtn")}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> {tnotif("saveThresholds")}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Email Preferences Tab ──────────────────────────────────────────────────

function EmailPrefsTab() {
  const tnotif = useTranslations("notifications");
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/preferences");
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) setPrefs(data.preferences);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const updatePref = async (field: string, value: boolean) => {
    const res = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      const data = await res.json();
      setPrefs(data);
    }
  };

  const handleToggleAll = async (enable: boolean) => {
    setSaving(true);
    const updates: Record<string, boolean> = {
      emailOnOrder: enable,
      emailOnCustomer: enable,
      emailOnProduct: enable,
      emailOnRevenue: enable,
      emailOnInventory: enable,
      emailOnDiscount: enable,
      emailOnCampaign: enable,
      emailOnAlert: enable,
    };
    const res = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      setPrefs(data);
      toast.success(enable ? tnotif("allEnabledToast") : tnotif("allDisabledToast"));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{tnotif("emailTitle")}</CardTitle>
              <CardDescription>{tnotif("emailDesc")}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleAll(true)}
                disabled={saving}
              >
                {tnotif("enableAll")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleAll(false)}
                disabled={saving}
              >
                {tnotif("disableAll")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100 dark:divide-gray-800">
          <Toggle
            checked={prefs?.emailOnOrder ?? true}
            onChange={(v) => updatePref("emailOnOrder", v)}
            label={tnotif("toggleEmailOrders")}
            description={tnotif("toggleEmailOrdersDesc")}
          />
          <Toggle
            checked={prefs?.emailOnCustomer ?? true}
            onChange={(v) => updatePref("emailOnCustomer", v)}
            label={tnotif("toggleEmailCustomers")}
            description={tnotif("toggleEmailCustomersDesc")}
          />
          <Toggle
            checked={prefs?.emailOnProduct ?? true}
            onChange={(v) => updatePref("emailOnProduct", v)}
            label={tnotif("toggleEmailProducts")}
            description={tnotif("toggleEmailProductsDesc")}
          />
          <Toggle
            checked={prefs?.emailOnRevenue ?? true}
            onChange={(v) => updatePref("emailOnRevenue", v)}
            label={tnotif("toggleEmailRevenue")}
            description={tnotif("toggleEmailRevenueDesc")}
          />
          <Toggle
            checked={prefs?.emailOnInventory ?? true}
            onChange={(v) => updatePref("emailOnInventory", v)}
            label={tnotif("toggleEmailInv")}
            description={tnotif("toggleEmailInvDesc")}
          />
          <Toggle
            checked={prefs?.emailOnDiscount ?? true}
            onChange={(v) => updatePref("emailOnDiscount", v)}
            label={tnotif("toggleEmailDisc")}
            description={tnotif("toggleEmailDiscDesc")}
          />
          <Toggle
            checked={prefs?.emailOnCampaign ?? true}
            onChange={(v) => updatePref("emailOnCampaign", v)}
            label={tnotif("toggleEmailCamp")}
            description={tnotif("toggleEmailCampDesc")}
          />
          <Toggle
            checked={prefs?.emailOnAlert ?? true}
            onChange={(v) => updatePref("emailOnAlert", v)}
            label={tnotif("toggleEmailAlert")}
            description={tnotif("toggleEmailAlertDesc")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 text-center">
          <Mail className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {tnotif("emailDeliveryTitle")}
          </h3>
          <p className="text-xs text-gray-400 mt-1">{tnotif("emailDeliveryDesc")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
