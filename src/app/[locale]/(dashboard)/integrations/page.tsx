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
import { Pencil, Trash2, Power, PowerOff, XCircle, AlertTriangle, Loader2 } from "lucide-react";
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

const WEBHOOK_EVENTS = [
  { value: "order.created", label: "Order Created" },
  { value: "order.updated", label: "Order Updated" },
  { value: "order.cancelled", label: "Order Cancelled" },
  { value: "order.refunded", label: "Order Refunded" },
  { value: "customer.created", label: "Customer Created" },
  { value: "customer.updated", label: "Customer Updated" },
  { value: "product.created", label: "Product Created" },
  { value: "product.updated", label: "Product Updated" },
  { value: "product.low_stock", label: "Low Stock Alert" },
  { value: "payment.completed", label: "Payment Completed" },
  { value: "payment.failed", label: "Payment Failed" },
];

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
  return t(key);
}

function getGroupLabel(label: string, t: (key: string) => string) {
  return t("group" + label);
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
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{key.name}</h3>
                      <Badge variant={key.status === "ACTIVE" ? "success" : "danger"}>
                        {key.status}
                      </Badge>
                      <Badge variant="info">{key.permissions}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                        {key.prefix}
                      </code>
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
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRevoke(key.id, key.status)}
                      title={key.status === "ACTIVE" ? t("revokeKey") : t("reactivateKey")}
                    >
                      {key.status === "ACTIVE" ? (
                        <PowerOff className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Power className="h-4 w-4 text-green-500" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(key.id)}
                      title={t("deleteKey")}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTest(ep.id)}
                      disabled={testing === ep.id}
                      title={t("testWebhook")}
                    >
                      {testing === ep.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCwIcon size={16} className="h-4 w-4 text-blue-500" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleStatus(ep.id, ep.status)}
                      title={ep.status === "ACTIVE" ? t("pauseWebhook") : t("activateWebhook")}
                    >
                      {ep.status === "ACTIVE" ? (
                        <PowerOff className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Power className="h-4 w-4 text-green-500" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(ep)}
                      title={t("editWebhook")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(ep.id)}
                      title={t("deleteWebhook")}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
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
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
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
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                <div
                  className="flex items-start justify-between gap-4 cursor-pointer"
                  onClick={() => setExpandedDelivery(expandedDelivery === d.id ? null : d.id)}
                >
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
                </div>

                {/* Expanded Details */}
                {expandedDelivery === d.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">{t("endpointUrl")}</p>
                      <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded block break-all">
                        {d.endpoint.url}
                      </code>
                    </div>
                    {d.payload && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">{t("payload")}</p>
                        <pre className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap">
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
                        <pre className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded max-h-32 overflow-auto whitespace-pre-wrap">
                          {d.response}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
