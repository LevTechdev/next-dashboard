"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  RefreshCwIcon,
  ClockIcon,
  PlusIcon,
  CopyIcon,
  SearchIcon,
  KeyIcon,
  EarthIcon,
  CircleCheckIcon,
} from "lucide-animated";
import {
  Pencil,
  Trash2,
  Power,
  PowerOff,
  XCircle,
  AlertTriangle,
  Loader2,
  FlaskConical,
  SquareTerminal,
  ChevronDown,
  MessageSquare,
  Network,
} from "lucide-react";
import { ChatAlertsHub } from "@/components/integrations/chat-alerts-hub";
import { InboundWebhookSync } from "@/components/integrations/inbound-webhook-sync";
import { cn } from "@/lib/utils";
import { AnimatedDisclosure } from "@/components/ui/animated-disclosure";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  status: string;
  statusCode: number | null;
  payload: string | null;
  response: string | null;
  durationMs: number | null;
  createdAt: string;
  endpoint: { name: string; url: string };
}

const EVENT_GROUPS = [
  {
    label: "Orders",
    events: ["order.created", "order.updated", "order.cancelled", "order.refunded"],
  },
  { label: "Customers", events: ["customer.created", "customer.updated"] },
  { label: "Products", events: ["product.created", "product.updated", "product.low_stock"] },
  { label: "Payments", events: ["payment.completed", "payment.failed"] },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null, locale: string = "en-US") {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEventLabel(value: string, t: (key: string) => string) {
  const key =
    "event" +
    value
      .split(".")
      .map((part) =>
        part
          .split("_")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(""),
      )
      .join("");
  const label = t(key);
  // Fall back to the raw event name instead of the raw key path when a locale
  // is missing the entry (next-intl returns the key itself and logs
  // MISSING_MESSAGE in that case).
  return label === key ? value : label;
}

function getGroupLabel(label: string, t: (key: string) => string) {
  return t("group" + label);
}

function formatJson(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const t = useTranslations("integrations");
  const [activeTab, setActiveTab] = useState("api-keys");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <KeyIcon size={16} className="h-4 w-4" />
            {t("tabApiKeys")}
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <EarthIcon size={16} className="h-4 w-4" />
            {t("tabWebhooks")}
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="flex items-center gap-2">
            <ClockIcon size={16} className="h-4 w-4" />
            {t("tabDeliveries")}
          </TabsTrigger>
          <TabsTrigger value="dlq" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {t("tabDlq")}
          </TabsTrigger>
          <TabsTrigger value="chat-alerts" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            {t("tabChatAlerts")}
          </TabsTrigger>
          <TabsTrigger value="omnichannel" className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            {t("tabOmnichannel")}
          </TabsTrigger>
          <TabsTrigger value="playground" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            {t("tabPlayground")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="mt-6">
          <ApiKeysTab />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-6">
          <WebhooksTab />
        </TabsContent>
        <TabsContent value="deliveries" className="mt-6">
          <DeliveriesTab />
        </TabsContent>
        <TabsContent value="dlq" className="mt-6">
          <DlqTab />
        </TabsContent>
        <TabsContent value="chat-alerts" className="mt-6">
          <ChatAlertsHub />
        </TabsContent>
        <TabsContent value="omnichannel" className="mt-6">
          <InboundWebhookSync />
        </TabsContent>
        <TabsContent value="playground" className="mt-6">
          <PlaygroundTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── API Keys Tab ───────────────────────────────────────────────────────────

function ApiKeysTab() {
  const t = useTranslations("integrations");
  const tc = useTranslations("common");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPerms, setNewKeyPerms] = useState("read");
  const [newKeyExpiry, setNewKeyExpiry] = useState("never");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchKeys();
    };
    init();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error(t("keyNameRequired"));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          permissions: newKeyPerms,
          expiresInDays: newKeyExpiry === "never" ? null : parseInt(newKeyExpiry),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || t("createKeyFailed"));
        return;
      }
      const data = await res.json();
      setShowNewKey(data.key);
      setShowCreate(false);
      setNewKeyName("");
      setNewKeyPerms("read");
      setNewKeyExpiry("never");
      await fetchKeys();
      toast.success(t("keyCreatedToast"));
    } catch {
      toast.error(t("createKeyFailed"));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "REVOKED" : "ACTIVE";
    try {
      const res = await fetch("/api/api-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) {
        toast.error(t("keyUpdatedToast"));
        return;
      }
      await fetchKeys();
      toast.success(newStatus === "REVOKED" ? t("keyRevokedToast") : t("keyReactivatedToast"));
    } catch {
      toast.error(t("keyUpdatedToast"));
    }
  };

  const confirm = useConfirm();

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      description: t("confirmDeleteKey"),
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
        toast.error(t("deleteKeyFailedToast"));
        return;
      }
      await fetchKeys();
      toast.success(t("keyDeletedToast"));
    } catch {
      toast.error(t("deleteKeyFailedToast"));
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success(t("keyCopiedToast"));
  };

  const filteredKeys = keys.filter((k) => k.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* New Key Reveal Banner */}
      {showNewKey && (
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CircleCheckIcon size={20} className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                  {t("keyCreatedTitle")}
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                  {t("keyCreatedWarning")}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm font-mono break-all">
                    {showNewKey}
                  </code>
                  <Button size="sm" variant="secondary" onClick={() => handleCopyKey(showNewKey)}>
                    <CopyIcon size={16} className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 text-emerald-700 dark:text-emerald-400"
                  onClick={() => setShowNewKey(null)}
                >
                  {t("dismiss")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          />
          <Input
            placeholder={tc("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex-1" />
        <Button onClick={() => setShowCreate(true)}>
          <PlusIcon size={16} className="h-4 w-4 mr-2" /> {t("createKey")}
        </Button>
      </div>

      {/* Keys List */}
      {filteredKeys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <KeyIcon size={48} className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">
              {search ? t("noKeysMatch") : t("noKeys")}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {search ? t("tryDifferentSearch") : t("createFirstKey")}
            </p>
            {!search && (
              <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>
                <PlusIcon size={16} className="h-4 w-4 mr-2" /> {t("createKey")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredKeys.map((key) => (
            <Card key={key.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold truncate">{key.name}</h3>
                      <Badge variant={key.status === "ACTIVE" ? "success" : "danger"}>
                        {key.status}
                      </Badge>
                      <Badge variant="info">{key.permissions}</Badge>
                    </div>
                    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                          {key.prefix}
                        </code>
                        <Tooltip content={tc("copy")} side="top">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleCopyKey(key.prefix)}
                            aria-label={tc("copy")}
                          >
                            <CopyIcon size={14} className="h-3.5 w-3.5 text-gray-400" />
                          </Button>
                        </Tooltip>
                      </span>
                      {key.lastUsedAt && (
                        <span>
                          {t("lastUsed")} {formatDate(key.lastUsedAt)}
                        </span>
                      )}
                      {key.expiresAt && (
                        <span>
                          {t("expires")} {formatDate(key.expiresAt)}
                        </span>
                      )}
                      <span>
                        {t("created")} {formatDate(key.createdAt)}
                      </span>
                    </div>
                  </div>
                  {/* Action row: wraps under the info block on mobile, inline column on ≥sm */}
                  <div className="flex items-center gap-1 shrink-0 max-sm:self-end">
                    <Tooltip
                      content={key.status === "ACTIVE" ? t("revokeKey") : t("reactivateKey")}
                      side="top"
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevoke(key.id, key.status)}
                        aria-label={key.status === "ACTIVE" ? t("revokeKey") : t("reactivateKey")}
                      >
                        {key.status === "ACTIVE" ? (
                          <PowerOff size={16} className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Power size={16} className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    </Tooltip>
                    <Tooltip content={t("deleteKey")} side="top">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(key.id)}
                        aria-label={t("deleteKey")}
                      >
                        <Trash2 size={16} className="h-4 w-4 text-red-500" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createKeyTitle")}</DialogTitle>
            <DialogDescription>{t("createKeyDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("keyNameLabel")}</label>
              <Input
                placeholder={t("keyNamePlaceholder")}
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("permissionsLabel")}</label>
              <Select value={newKeyPerms} onValueChange={setNewKeyPerms}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">{t("permissionReadOnly")}</SelectItem>
                  <SelectItem value="read,write">{t("permissionReadWrite")}</SelectItem>
                  <SelectItem value="admin">{t("permissionAdmin")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400 mt-1">{t("permissionHelp")}</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("expirationLabel")}</label>
              <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">{t("expiryNever")}</SelectItem>
                  <SelectItem value="7">{t("expiry7days")}</SelectItem>
                  <SelectItem value="30">{t("expiry30days")}</SelectItem>
                  <SelectItem value="90">{t("expiry90days")}</SelectItem>
                  <SelectItem value="365">{t("expiry1year")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("creating")}
                </>
              ) : (
                <>
                  <KeyIcon size={16} className="h-4 w-4 mr-2" /> {t("generateKey")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Webhooks Tab ───────────────────────────────────────────────────────────

function WebhooksTab() {
  const t = useTranslations("integrations");
  const tc = useTranslations("common");
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<WebhookEndpoint | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);

  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setEndpoints(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchEndpoints();
    };
    init();
  }, [fetchEndpoints]);

  const resetForm = () => {
    setFormName("");
    setFormUrl("");
    setFormDescription("");
    setFormEvents([]);
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formUrl.trim()) {
      toast.error(t("nameUrlRequired"));
      return;
    }
    if (formEvents.length === 0) {
      toast.error(t("selectEvent"));
      return;
    }
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          url: formUrl,
          events: formEvents,
          description: formDescription,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || t("createWebhookFailed"));
        return;
      }
      const data = await res.json();
      setShowSecret(data.secret);
      setShowCreate(false);
      resetForm();
      await fetchEndpoints();
      toast.success(t("webhookCreatedToast"));
    } catch {
      toast.error(t("createWebhookFailed"));
    }
  };

  const handleUpdate = async () => {
    if (!showEdit) return;
    if (!formName.trim() || !formUrl.trim()) {
      toast.error(t("nameUrlRequired"));
      return;
    }
    if (formEvents.length === 0) {
      toast.error(t("selectEvent"));
      return;
    }
    try {
      const res = await fetch("/api/webhooks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: showEdit.id,
          name: formName,
          url: formUrl,
          events: formEvents,
          description: formDescription,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || t("updateWebhookFailed"));
        return;
      }
      setShowEdit(null);
      resetForm();
      await fetchEndpoints();
      toast.success(t("webhookUpdatedToast"));
    } catch {
      toast.error(t("updateWebhookFailed"));
    }
  };

  const confirm = useConfirm();

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      description: t("confirmDeleteWebhook"),
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
        toast.error(t("deleteWebhookFailed"));
        return;
      }
      await fetchEndpoints();
      toast.success(t("webhookDeletedToast"));
    } catch {
      toast.error(t("deleteWebhookFailed"));
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch("/api/webhooks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) {
        toast.error(t("updateWebhookFailed"));
        return;
      }
      await fetchEndpoints();
      toast.success(newStatus === "PAUSED" ? t("webhookPausedToast") : t("webhookActivatedToast"));
    } catch {
      toast.error(t("updateWebhookFailed"));
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const res = await fetch("/api/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          data.status === "DELIVERED"
            ? t("testSuccessfulToast", { statusCode: data.statusCode, durationMs: data.durationMs })
            : t("testFailedToast", { code: data.statusCode || "timeout" }),
        );
        await fetchEndpoints();
      } else {
        toast.error(data.error || t("testRequestFailed"));
      }
    } catch {
      toast.error(t("testRequestFailed"));
    } finally {
      setTesting(null);
    }
  };

  const openEdit = (ep: WebhookEndpoint) => {
    setFormName(ep.name);
    setFormUrl(ep.url);
    setFormDescription(ep.description || "");
    setFormEvents(ep.subscribedEvents);
    setShowEdit(ep);
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const selectAllInGroup = (events: string[]) => {
    const allSelected = events.every((e) => formEvents.includes(e));
    if (allSelected) {
      setFormEvents((prev) => prev.filter((e) => !events.includes(e)));
    } else {
      const newEvents = [...formEvents];
      events.forEach((e) => {
        if (!newEvents.includes(e)) newEvents.push(e);
      });
      setFormEvents(newEvents);
    }
  };

  const filteredEndpoints = endpoints.filter(
    (ep) =>
      ep.name.toLowerCase().includes(search.toLowerCase()) ||
      ep.url.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Secret Reveal Banner */}
      {showSecret && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  {t("webhookSecretTitle")}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  {t("webhookSecretWarning")}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg text-sm font-mono break-all">
                    {showSecret}
                  </code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(showSecret);
                      toast.success(t("secretCopied"));
                    }}
                  >
                    <CopyIcon size={16} className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 text-amber-700 dark:text-amber-400"
                  onClick={() => setShowSecret(null)}
                >
                  {t("dismiss")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          />
          <Input
            placeholder={tc("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex-1" />
        <Button
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
        >
          <PlusIcon size={16} className="h-4 w-4 mr-2" /> {t("addEndpoint")}
        </Button>
      </div>

      {/* Endpoints List */}
      {filteredEndpoints.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <EarthIcon size={48} className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">
              {search ? t("noWebhooksMatch") : t("noWebhooks")}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {search ? t("tryDifferentSearch") : t("createFirstWebhook")}
            </p>
            {!search && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  resetForm();
                  setShowCreate(true);
                }}
              >
                <PlusIcon size={16} className="h-4 w-4 mr-2" /> {t("addEndpoint")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEndpoints.map((ep) => (
            <Card key={ep.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold">{ep.name}</h3>
                      <Badge
                        variant={
                          ep.status === "ACTIVE"
                            ? "success"
                            : ep.status === "PAUSED"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {ep.status}
                      </Badge>
                      {ep.lastStatus && (
                        <Badge variant={ep.lastStatus === "success" ? "success" : "danger"}>
                          {t("last")} {ep.lastStatus}
                        </Badge>
                      )}
                    </div>
                    <code className="text-xs font-mono text-gray-500 dark:text-gray-400 break-all">
                      {ep.url}
                    </code>
                    {ep.description && (
                      <p className="text-xs text-gray-400 mt-1">{ep.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>
                        {t("events")}{" "}
                        {ep.subscribedEvents
                          .slice(0, 3)
                          .map((e) => getEventLabel(e, t))
                          .join(", ")}
                        {ep.subscribedEvents.length > 3 &&
                          ` ${t("more", { count: ep.subscribedEvents.length - 3 })}`}
                      </span>
                      <span>
                        {t("deliveriesLabel")} {ep._count.deliveries}
                      </span>
                      {ep.lastTriggeredAt && (
                        <span>
                          {t("last")} {formatDate(ep.lastTriggeredAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Tooltip content={t("testWebhook")} side="top">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTest(ep.id)}
                        disabled={testing === ep.id}
                        aria-label={t("testWebhook")}
                      >
                        {testing === ep.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCwIcon size={16} className="h-4 w-4 text-blue-500" />
                        )}
                      </Button>
                    </Tooltip>
                    <Tooltip
                      content={ep.status === "ACTIVE" ? t("pauseWebhook") : t("activateWebhook")}
                      side="top"
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleStatus(ep.id, ep.status)}
                        aria-label={
                          ep.status === "ACTIVE" ? t("pauseWebhook") : t("activateWebhook")
                        }
                      >
                        {ep.status === "ACTIVE" ? (
                          <PowerOff size={16} className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Power size={16} className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    </Tooltip>
                    <Tooltip content={t("editWebhook")} side="top">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(ep)}
                        aria-label={t("editWebhook")}
                      >
                        <Pencil size={16} className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t("deleteWebhook")} side="top">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(ep.id)}
                        aria-label={t("deleteWebhook")}
                      >
                        <Trash2 size={16} className="h-4 w-4 text-red-500" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreate || !!showEdit}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setShowEdit(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{showEdit ? t("editWebhookTitle") : t("addWebhookTitle")}</DialogTitle>
            <DialogDescription>
              {showEdit ? t("editWebhookDesc") : t("addWebhookDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("nameLabel")}</label>
              <Input
                placeholder={t("namePlaceholder")}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("endpointUrlLabel")}</label>
              <Input
                placeholder={t("endpointUrlPlaceholder")}
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                type="url"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("descriptionLabel")}</label>
              <Input
                placeholder={t("descriptionPlaceholder")}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("subscribeEvents")}</label>
              <div className="space-y-3 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                {EVENT_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <input
                        type="checkbox"
                        id={`group-${group.label}`}
                        className="rounded border-gray-300 text-primary focus:ring-ring"
                        checked={group.events.every((e) => formEvents.includes(e))}
                        onChange={() => selectAllInGroup(group.events)}
                      />
                      <label
                        htmlFor={`group-${group.label}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {getGroupLabel(group.label, t)}
                      </label>
                    </div>
                    <div className="ml-6 space-y-1">
                      {group.events.map((event) => (
                        <label
                          key={event}
                          className="flex items-center gap-2 cursor-pointer py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={formEvents.includes(event)}
                            onChange={() => toggleEvent(event)}
                            className="rounded border-gray-300 text-primary focus:ring-ring"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {getEventLabel(event, t)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreate(false);
                setShowEdit(null);
                resetForm();
              }}
            >
              {tc("cancel")}
            </Button>
            <Button onClick={showEdit ? handleUpdate : handleCreate}>
              <EarthIcon size={16} className="h-4 w-4 mr-2" />
              {showEdit ? t("updateWebhook") : t("createWebhookBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Deliveries Tab ─────────────────────────────────────────────────────────

function DeliveriesTab() {
  const t = useTranslations("integrations");
  const tc = useTranslations("common");
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEndpoint, setSelectedEndpoint] = useState("all");
  const [endpoints, setEndpoints] = useState<{ id: string; name: string }[]>([]);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);

  const fetchDeliveries = useCallback(async () => {
    try {
      const url =
        selectedEndpoint === "all"
          ? "/api/webhooks/deliveries"
          : `/api/webhooks/deliveries?endpointId=${selectedEndpoint}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedEndpoint]);

  const fetchEndpointList = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setEndpoints(data.map((ep: WebhookEndpoint) => ({ id: ep.id, name: ep.name })));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchEndpointList();
    };
    init();
  }, [fetchEndpointList]);

  useEffect(() => {
    const init = async () => {
      await fetchDeliveries();
    };
    init();
  }, [fetchDeliveries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder={t("allEndpointsPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allEndpoints")}</SelectItem>
            {endpoints.map((ep) => (
              <SelectItem key={ep.id} value={ep.id}>
                {ep.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchDeliveries}>
          <RefreshCwIcon size={16} className="h-4 w-4 mr-2" /> {tc("refresh")}
        </Button>
      </div>

      {/* Deliveries List */}
      {deliveries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClockIcon size={48} className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">
              {t("noDeliveries")}
            </h3>
            <p className="text-sm text-gray-400 mt-1">{t("noDeliveriesDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deliveries.map((d) => (
            <Card key={d.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <AnimatedDisclosure
                  open={expandedDelivery === d.id}
                  onToggle={() => setExpandedDelivery(expandedDelivery === d.id ? null : d.id)}
                  trigger={({ open }) => (
                    <>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div>
                          {d.status === "DELIVERED" ? (
                            <CircleCheckIcon size={20} className="h-5 w-5 text-green-500" />
                          ) : d.status === "PENDING" ? (
                            <ClockIcon size={20} className="h-5 w-5 text-amber-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{getEventLabel(d.event, t)}</span>
                            <Badge
                              variant={
                                d.status === "DELIVERED"
                                  ? "success"
                                  : d.status === "PENDING"
                                    ? "warning"
                                    : "danger"
                              }
                            >
                              {d.status}
                            </Badge>
                            {d.statusCode && (
                              <span className="text-xs text-gray-500">
                                {t("statusHttp", { code: d.statusCode })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            <span>{d.endpoint.name}</span>
                            {d.durationMs && <span>{d.durationMs}ms</span>}
                            <span>{formatDate(d.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronDown
                        size={16}
                        className={cn(
                          "h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200",
                          open && "rotate-180",
                        )}
                      />
                    </>
                  )}
                  triggerClassName="flex items-start justify-between gap-4 w-full text-left cursor-pointer group"
                  contentClassName="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800"
                >
                  {/* Expanded Details */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">{t("endpointUrl")}</p>
                      <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded block break-all">
                        {d.endpoint.url}
                      </code>
                    </div>
                    {d.payload && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">{t("payload")}</p>
                        <pre className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded max-h-40 overflow-auto scrollbar-thin whitespace-pre-wrap">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(d.payload), null, 2);
                            } catch {
                              return d.payload;
                            }
                          })()}
                        </pre>
                      </div>
                    )}
                    {d.response && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">{t("response")}</p>
                        <pre className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded max-h-32 overflow-auto scrollbar-thin whitespace-pre-wrap">
                          {d.response}
                        </pre>
                      </div>
                    )}
                  </div>
                </AnimatedDisclosure>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DLQ Tab (delivery health: failed inbound webhooks) ─────────────────

interface DlqEntry {
  id: string;
  platform: string;
  event: string;
  payload: any;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  status: "FAILED" | "RETRYING" | "RESOLVED";
  transient?: boolean;
  createdAt: string;
  lastAttemptAt: string;
  nextRetryAt?: string;
}

interface DlqSummary {
  totalFailed: number;
  totalRetrying: number;
  totalResolved: number;
  totalExhausted: number;
  totalCount: number;
}

const DLQ_PLATFORM_LABELS: Record<string, string> = {
  shopify: "Shopify",
  tiktok: "TikTok Shop",
  shopee: "Shopee",
  woocommerce: "WooCommerce",
};

function DlqTab() {
  const t = useTranslations("integrations");
  const tc = useTranslations("common");
  const confirm = useConfirm();
  const [entries, setEntries] = useState<DlqEntry[]>([]);
  const [summary, setSummary] = useState<DlqSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchDlq = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks/inbound/dlq", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setSummary(data.summary || null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDlq();
  }, [fetchDlq]);

  const act = async (id: string, action: "replay" | "discard") => {
    setBusyId(id);
    try {
      const res = await fetch("/api/webhooks/inbound/dlq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        toast.success(data.message || (action === "replay" ? "Replayed" : "Discarded"));
      } else {
        toast.error(data.message || "Action failed");
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setBusyId(null);
      fetchDlq();
    }
  };

  const handleDiscard = async (entry: DlqEntry) => {
    const ok = await confirm({
      title: t("dlqDiscardConfirmTitle"),
      description: t("dlqDiscardConfirmDesc"),
      confirmLabel: tc("delete"),
    });
    if (ok) act(entry.id, "discard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const statusTone = (s: DlqEntry["status"], exhausted: boolean) =>
    s === "RESOLVED" ? "success" : exhausted ? "danger" : s === "RETRYING" ? "warning" : "info";

  return (
    <div className="space-y-6">
      {/* Health summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("dlqFailed"), value: summary?.totalFailed ?? 0, tone: "text-red-500" },
          { label: t("dlqRetrying"), value: summary?.totalRetrying ?? 0, tone: "text-amber-500" },
          { label: t("dlqResolved"), value: summary?.totalResolved ?? 0, tone: "text-green-500" },
          { label: t("dlqTotal"), value: summary?.totalCount ?? 0, tone: "text-foreground" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={cn("text-2xl font-bold tabular-nums", s.tone)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CircleCheckIcon size={48} className="h-12 w-12 text-green-500/60 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">
              {t("dlqEmpty")}
            </h3>
            <p className="text-sm text-gray-400 mt-1">{t("dlqEmptyDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const exhausted =
              e.status === "FAILED" && e.retryCount >= e.maxRetries && !e.nextRetryAt;
            return (
              <Card key={e.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <AnimatedDisclosure
                        open={expandedId === e.id}
                        onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
                        trigger={() => (
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div>
                              {e.status === "RESOLVED" ? (
                                <CircleCheckIcon size={20} className="h-5 w-5 text-green-500" />
                              ) : e.status === "RETRYING" ? (
                                <RefreshCwIcon
                                  size={20}
                                  className="h-5 w-5 text-amber-500 animate-spin [animation-duration:2.5s]"
                                />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{e.event}</span>
                                <Badge variant="outline">
                                  {DLQ_PLATFORM_LABELS[e.platform] || e.platform}
                                </Badge>
                                <Badge variant={statusTone(e.status, exhausted)}>
                                  {exhausted ? t("dlqExhausted") : e.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                <span className="truncate max-w-xs" title={e.errorMessage}>
                                  {e.errorMessage}
                                </span>
                                <span>
                                  {t("dlqAttempts", { count: e.retryCount, max: e.maxRetries })}
                                </span>
                                <span>{formatDate(e.lastAttemptAt)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        triggerClassName="flex items-start justify-between gap-4 w-full text-left cursor-pointer group"
                        contentClassName="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800"
                      >
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">
                              {t("dlqError")}
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {e.errorMessage}
                            </p>
                          </div>
                          {e.nextRetryAt && e.status === "RETRYING" && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">
                                {t("dlqNextRetry")}
                              </p>
                              <p className="text-xs">{formatDate(e.nextRetryAt)}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">
                              {t("payload")}
                            </p>
                            <pre className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded max-h-40 overflow-auto scrollbar-thin whitespace-pre-wrap">
                              {(() => {
                                try {
                                  return JSON.stringify(e.payload, null, 2);
                                } catch {
                                  return String(e.payload);
                                }
                              })()}
                            </pre>
                          </div>
                        </div>
                      </AnimatedDisclosure>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === e.id || e.status === "RESOLVED"}
                        onClick={() => act(e.id, "replay")}
                      >
                        <RefreshCwIcon
                          size={14}
                          className={cn("h-3.5 w-3.5 mr-1.5", busyId === e.id && "animate-spin")}
                        />
                        {t("dlqReplay")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        disabled={busyId === e.id}
                        onClick={() => handleDiscard(e)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        {t("dlqDiscard")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Playground Tab ─────────────────────────────────────────────────────────

function PlaygroundTab() {
  const t = useTranslations("integrations");
  const [apiKey, setApiKey] = useState("");
  const [latestPrefix, setLatestPrefix] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    status: number;
    ok: boolean;
    latencyMs: number;
    data: unknown;
  } | null>(null);

  // Show the most recently created key prefix so users can pick which saved
  // key to test (raw keys are only ever shown once, at creation).
  useEffect(() => {
    let active = true;
    fetch("/api/api-keys")
      .then((r) => (r.ok ? r.json() : []))
      .then((keys) => {
        if (active && Array.isArray(keys) && keys.length > 0) {
          setLatestPrefix(keys[0].prefix || null);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const whoamiUrl = `${baseUrl}/api/v1/whoami`;

  const handleSend = async () => {
    const key = apiKey.trim();
    if (!key) {
      toast.error(t("missingKey"));
      return;
    }
    setSending(true);
    const start = performance.now();
    try {
      const res = await fetch("/api/v1/whoami", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await res.json().catch(() => null);
      setResult({
        status: res.status,
        ok: res.ok,
        latencyMs: Math.round(performance.now() - start),
        data,
      });
    } catch {
      setResult({ status: 0, ok: false, latencyMs: 0, data: null });
      toast.error(t("requestFailed"));
    } finally {
      setSending(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("copied"));
  };

  const placeholder = apiKey.trim() || "dash_…";
  const curlSample = `curl -H "Authorization: Bearer ${placeholder}" \\
  ${whoamiUrl}`;
  const fetchSample = `const res = await fetch("${whoamiUrl}", {
  headers: { Authorization: "Bearer ${placeholder}" },
});`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      {/* Request builder + response */}
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-indigo-500" />
              <CardTitle>{t("playgroundTitle")}</CardTitle>
            </div>
            <CardDescription>{t("playgroundDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("endpointLabel")}</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono">
                  {t("whoamiEndpoint")}
                </code>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">{t("whoamiDesc")}</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("apiKeyLabel")}</label>
              <div className="flex gap-2">
                <Input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t("apiKeyPlaceholder")}
                  className="font-mono"
                  onKeyDown={(e) => e.key === "Enter" && !sending && handleSend()}
                />
                <Button variant="outline" onClick={handleSend} disabled={sending}>
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("sending")}
                    </>
                  ) : (
                    <>
                      <FlaskConical className="h-4 w-4 mr-2" /> {t("sendRequest")}
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {t("apiKeyHint")}
                {latestPrefix ? ` ${t("latestPrefix")}: ${latestPrefix}` : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SquareTerminal className="h-5 w-5 text-emerald-500" />
                <CardTitle>{t("responseLabel")}</CardTitle>
              </div>
              {result && (
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-semibold ${result.status >= 200 && result.status < 300 ? "text-green-600" : "text-red-500"}`}
                  >
                    {t("statusLabel")}: {result.status || "ERR"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {t("latency")}: {result.latencyMs}ms
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                    {t("clear")}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {result === null ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <SquareTerminal className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">{t("noResponse")}</p>
              </div>
            ) : (
              <div className="relative">
                <pre className="text-xs font-mono bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 p-4 rounded-lg overflow-auto scrollbar-thin max-h-80 whitespace-pre-wrap">
                  {result.data === null ? t("requestFailed") : formatJson(result.data)}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 bg-white/80 dark:bg-gray-900/60"
                  onClick={() => copyText(formatJson(result.data))}
                >
                  <CopyIcon size={14} className="h-3.5 w-3.5 mr-1" />
                  {t("copyResponse")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick start reference */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("quickStartTitle")}</CardTitle>
            <CardDescription>{t("quickStartDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                {t("baseUrlLabel")}
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono break-all">
                  {whoamiUrl}
                </code>
                <Button variant="ghost" size="sm" onClick={() => copyText(whoamiUrl)}>
                  <CopyIcon size={14} className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                {t("authHeaderLabel")}
              </label>
              <code className="block px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono break-all">
                Authorization: Bearer {placeholder}
              </code>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                {t("exampleCurl")}
              </label>
              <div className="relative">
                <pre className="text-xs font-mono bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 p-3 rounded-lg overflow-auto scrollbar-thin whitespace-pre-wrap">
                  {curlSample}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1.5 right-1.5 bg-white/80 dark:bg-gray-900/60"
                  onClick={() => copyText(curlSample)}
                >
                  <CopyIcon size={14} className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                {t("exampleFetch")}
              </label>
              <div className="relative">
                <pre className="text-xs font-mono bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 p-3 rounded-lg overflow-auto scrollbar-thin whitespace-pre-wrap">
                  {fetchSample}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1.5 right-1.5 bg-white/80 dark:bg-gray-900/60"
                  onClick={() => copyText(fetchSample)}
                >
                  <CopyIcon size={14} className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-gray-400">{t("scopeHint")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
