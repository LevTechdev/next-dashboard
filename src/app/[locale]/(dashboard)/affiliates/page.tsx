"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  PlusIcon,
  RefreshCwIcon,
  CopyIcon,
  LinkIcon,
  TrendingUpIcon,
  DollarSignIcon,
} from "lucide-animated";
import {
  Share2,
  Store,
  MousePointerClick,
  Plug,
  Trash2,
  ExternalLink,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lightbox } from "@/components/ui/lightbox";
import { ShareLinkDialog } from "@/components/share-link-dialog";
import { useConfirm } from "@/components/ui/confirm-provider";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { formatCurrency, formatDateTime, cn, sanitizeInteger } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";

const STATUS_STYLES: Record<string, string> = {
  CONNECTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  DISCONNECTED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  ERROR: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const CONV_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

/** Maps a fetch tier from the importer to its i18n label key. */
const TIER_KEYS: Record<string, string> = {
  "shopee-api": "tierShopeeApi",
  direct: "tierDirect",
  "facebook-crawler": "tierFacebook",
  "twitter-crawler": "tierTwitter",
  headless: "tierHeadless",
  manual: "tierManual",
};

/** Truncate very long marketplace product names for compact, readable display. */
function shortenName(name: string, max = 60): string {
  if (!name) return "";
  return name.length > max ? name.slice(0, max - 1).trimEnd() + "\u2026" : name;
}

export default function AffiliatesPage() {
  const { user } = useAuth();
  const t = useTranslations("affiliates");
  const tcommon = useTranslations("common");
  const role = (user as any)?.role;

  const [summary, setSummary] = useState<any>(null);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));

  // Connection dialog
  const [connPlatform, setConnPlatform] = useState<any>(null);
  const [connForm, setConnForm] = useState({
    apiKey: "",
    apiSecret: "",
    accessToken: "",
    shopId: "",
    storeUrl: "",
  });
  const [connSaving, setConnSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Link dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({
    productId: "",
    platformId: "",
    commissionType: "PERCENTAGE",
    commissionValue: "10",
    targetUrl: "",
  });
  const [linkSaving, setLinkSaving] = useState(false);

  // Import-from-URL dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importForm, setImportForm] = useState({
    name: "",
    price: "",
    image: "",
    commissionType: "PERCENTAGE",
    commissionValue: "10",
  });

  // Fullscreen image lightbox (shared by preview + links table)
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  // Share-link dialog (QR + social share)
  const [shareLink, setShareLink] = useState<any>(null);

  // Drag-and-drop state for the import cover picker
  const [importDrag, setImportDrag] = useState<{ from: number | null; over: number | null }>({
    from: null,
    over: null,
  });

  // Edit-link dialog
  const [editLink, setEditLink] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    commissionType: "PERCENTAGE",
    commissionValue: "10",
    targetUrl: "",
    isActive: true,
  });
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const loadAll = useCallback(() => {
    return Promise.all([
      fetch("/api/affiliates/summary").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/affiliates/platforms").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/affiliates/links").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/affiliates/conversions").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/products").then((r) => (r.ok ? r.json() : [])),
    ]).then(([s, p, l, c, prods]) => {
      setSummary(s);
      setPlatforms(p);
      setLinks(l);
      setConversions(c);
      setProducts(Array.isArray(prods) ? prods : prods.products || []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const affiliateUrl = (code: string) => `${origin}/api/aff/${code}`;

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(affiliateUrl(code));
    toast.success(t("linkCopied"));
  };

  // ── Connection handlers ──
  const openConnect = (platform: any) => {
    setConnPlatform(platform);
    setConnForm({
      apiKey: platform.connection?.apiKey || "",
      apiSecret: "",
      accessToken: "",
      shopId: platform.connection?.shopId || "",
      storeUrl: platform.connection?.storeUrl || "",
    });
  };

  const saveConnection = async () => {
    if (!connPlatform) return;
    setConnSaving(true);
    const res = await fetch(`/api/affiliates/platforms/${connPlatform.id}/connection`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(connForm),
    });
    const data = await res.json();
    setConnSaving(false);
    if (res.ok) {
      if (data.status === "CONNECTED")
        toast.success(t("connectedToast", { name: connPlatform.name }));
      else toast.error(data.lastError || t("connectionFailed"));
      setConnPlatform(null);
      loadAll();
    } else {
      toast.error(data.error || tcommon("error"));
    }
  };

  const confirm = useConfirm();

  const disconnect = async (platform: any) => {
    const ok = await confirm({
      description: t("disconnectConfirm", { name: platform.name }),
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/affiliates/platforms/${platform.id}/connection`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(t("disconnectedToast", { name: platform.name }));
      loadAll();
    }
  };

  const syncProducts = async (platform: any) => {
    setSyncingId(platform.id);
    const res = await fetch(`/api/affiliates/platforms/${platform.id}/sync`, { method: "POST" });
    const data = await res.json();
    setSyncingId(null);
    if (res.ok) {
      toast.success(
        t("syncResult", { total: data.total, created: data.created, updated: data.updated }),
      );
      loadAll();
    } else {
      toast.error(data.error || t("syncFailed"));
    }
  };

  const toggleHeadless = async (platform: any) => {
    const res = await fetch(`/api/affiliates/platforms/${platform.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headlessEnabled: !platform.headlessEnabled }),
    });
    if (res.ok) {
      toast.success(t("settingsSaved"));
      loadAll();
    } else {
      toast.error(tcommon("error"));
    }
  };

  // ── Link handlers ──
  const createLink = async () => {
    if (!linkForm.productId || !linkForm.platformId) {
      toast.error(t("selectProductPlatform"));
      return;
    }
    setLinkSaving(true);
    const res = await fetch("/api/affiliates/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(linkForm),
    });
    const data = await res.json();
    setLinkSaving(false);
    if (res.ok) {
      toast.success(t("linkCreated"));
      setLinkDialogOpen(false);
      setLinkForm({
        productId: "",
        platformId: "",
        commissionType: "PERCENTAGE",
        commissionValue: "10",
        targetUrl: "",
      });
      loadAll();
    } else {
      toast.error(data.error || tcommon("error"));
    }
  };

  const openEditLink = (link: any) => {
    setEditLink(link);
    setEditForm({
      commissionType: link.commissionType || "PERCENTAGE",
      commissionValue: String(link.commissionValue ?? "10"),
      targetUrl: link.targetUrl || "",
      isActive: link.isActive !== false,
    });
  };

  const saveEditLink = async () => {
    if (!editLink) return;
    setEditSaving(true);
    const res = await fetch(`/api/affiliates/links/${editLink.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commissionType: editForm.commissionType,
        commissionValue: editForm.commissionValue,
        targetUrl: editForm.targetUrl,
        isActive: editForm.isActive,
      }),
    });
    setEditSaving(false);
    if (res.ok) {
      toast.success(t("linkUpdated"));
      setEditLink(null);
      loadAll();
    } else {
      toast.error(tcommon("error"));
    }
  };

  const confirmDeleteLink = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    const res = await fetch(`/api/affiliates/links/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteSaving(false);
    if (res.ok) {
      toast.success(t("linkDeleted"));
      setDeleteTarget(null);
      loadAll();
    } else {
      toast.error(tcommon("error"));
    }
  };

  // ── Import-from-URL handlers ──
  const resetImport = () => {
    setImportUrl("");
    setImportPreview(null);
    setImportError(null);
    setImportForm({
      name: "",
      price: "",
      image: "",
      commissionType: "PERCENTAGE",
      commissionValue: "10",
    });
  };

  const fetchPreview = async () => {
    if (!importUrl.trim()) return;
    setImportLoading(true);
    setImportError(null);
    setImportPreview(null);
    try {
      const res = await fetch(
        `/api/affiliates/import-link?url=${encodeURIComponent(importUrl.trim())}`,
      );
      const data = await res.json();
      if (res.ok && data.product) {
        setImportPreview(data);
        setImportForm((f) => ({
          ...f,
          name: data.product.name || "",
          price: data.product.price ? String(data.product.price) : "",
          image: data.product.image || data.product.images?.[0] || "",
        }));
      } else {
        setImportError(data.error || t("importFailed"));
      }
    } catch {
      setImportError(t("importFailed"));
    } finally {
      setImportLoading(false);
    }
  };

  const importLink = async () => {
    if (!importUrl.trim()) return;
    setImportSaving(true);
    try {
      const res = await fetch("/api/affiliates/import-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: importUrl.trim(),
          name: importForm.name,
          price: importForm.price,
          image: importForm.image,
          images: importPreview?.product?.images || [],
          commissionType: importForm.commissionType,
          commissionValue: importForm.commissionValue,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t("linkCreated"));
        setImportOpen(false);
        resetImport();
        loadAll();
      } else {
        toast.error(data.error || tcommon("error"));
      }
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setImportSaving(false);
    }
  };

  /** Reorder the fetched image gallery in the import preview (drag-and-drop). */
  const reorderImportImages = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setImportPreview((prev: any) => {
      if (!prev?.product?.images) return prev;
      const imgs = [...prev.product.images];
      if (from >= imgs.length || to >= imgs.length) return prev;
      const [moved] = imgs.splice(from, 1);
      imgs.splice(to, 0, moved);
      return { ...prev, product: { ...prev.product, images: imgs } };
    });
  };

  const updateConversionStatus = async (id: string, status: string) => {
    const res = await fetch("/api/affiliates/conversions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      toast.success(t("conversionUpdated"));
      loadAll();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 shimmer rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-12 w-12 shimmer rounded-lg mb-4" />
                <div className="h-4 w-24 shimmer rounded mb-2" />
                <div className="h-8 w-32 shimmer rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="h-64 shimmer rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const canManage = can(role, "update", "affiliates");
  const totals = summary?.totals || { clicks: 0, conversions: 0, revenue: 0, commission: 0 };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="h-6 w-6 text-indigo-500" />
            {t("title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={loadAll} className="gap-1">
          <RefreshCwIcon size={14} className="h-3.5 w-3.5" />
          {tcommon("refresh")}
        </Button>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<MousePointerClick className="h-5 w-5 text-blue-500" />}
          label={t("totalClicks")}
          value={<AnimatedCounter end={totals.clicks} />}
        />
        <StatCard
          icon={<TrendingUpIcon size={20} className="h-5 w-5 text-purple-500" />}
          label={t("totalConversions")}
          value={<AnimatedCounter end={totals.conversions} />}
        />
        <StatCard
          icon={<DollarSignIcon size={20} className="h-5 w-5 text-emerald-500" />}
          label={t("attributedRevenue")}
          value={<AnimatedCounter end={totals.revenue} formatter={formatCurrency} />}
        />
        <StatCard
          icon={<Share2 className="h-5 w-5 text-indigo-500" />}
          label={t("totalCommission")}
          value={<AnimatedCounter end={totals.commission} formatter={formatCurrency} />}
        />
      </div>

      <Tabs defaultValue="platforms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="platforms">{t("tabPlatforms")}</TabsTrigger>
          <TabsTrigger value="links">{t("tabLinks")}</TabsTrigger>
          <TabsTrigger value="conversions">{t("tabConversions")}</TabsTrigger>
        </TabsList>

        {/* ═══ PLATFORMS TAB ═══ */}
        <TabsContent value="platforms" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {platforms.map((p: any) => {
              const status = p.connection?.status || "DISCONNECTED";
              return (
                <Card key={p.id} className="overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: p.color || "#6366f1" }} />
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm"
                          style={{ backgroundColor: p.color || "#6366f1" }}
                        >
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{p.name}</p>
                          <p className="text-xs text-gray-500">
                            {p._count?.links || 0} {t("links")}
                          </p>
                        </div>
                      </div>
                      <Badge className={STATUS_STYLES[status]}>{t(`status_${status}`)}</Badge>
                    </div>

                    {p.connection?.lastError && status === "ERROR" && (
                      <p className="text-xs text-red-500 mb-2 line-clamp-2">
                        {p.connection.lastError}
                      </p>
                    )}
                    {p.connection?.lastSyncAt && (
                      <p className="text-xs text-gray-400 mb-3">
                        {t("lastSync")}: {formatDateTime(p.connection.lastSyncAt)} ·{" "}
                        {p.connection.productsSynced} {t("productsSynced")}
                      </p>
                    )}

                    {canManage && (
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => openConnect(p)}
                        >
                          <Plug className="h-3.5 w-3.5 mr-1" />
                          {status === "CONNECTED" ? t("manage") : t("connect")}
                        </Button>
                        {status === "CONNECTED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => syncProducts(p)}
                            disabled={syncingId === p.id}
                            title={t("syncProducts")}
                          >
                            <RefreshCwIcon
                              size={14}
                              className={cn("h-3.5 w-3.5", syncingId === p.id && "animate-spin")}
                            />
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Per-platform headless fallback toggle for URL imports */}
                    {canManage && (
                      <label className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 cursor-pointer">
                        <span className="text-xs text-gray-500">{t("headlessFallback")}</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-indigo-500 cursor-pointer"
                          checked={p.headlessEnabled !== false}
                          onChange={() => toggleHeadless(p)}
                          aria-label={t("headlessFallback")}
                        />
                      </label>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ═══ LINKS TAB ═══ */}
        <TabsContent value="links" className="space-y-4">
          <div className="flex justify-end gap-2">
            {can(role, "create", "affiliates") && (
              <>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <LinkIcon size={16} className="h-4 w-4 mr-2" />
                  {t("importFromUrl")}
                </Button>
                <Button onClick={() => setLinkDialogOpen(true)}>
                  <PlusIcon size={16} className="h-4 w-4 mr-2" />
                  {t("createLink")}
                </Button>
              </>
            )}
          </div>
          <Card>
            <CardContent className="p-0 sm:p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("product")}</TableHead>
                      <TableHead>{t("platform")}</TableHead>
                      <TableHead>{t("commission")}</TableHead>
                      <TableHead>{t("clicks")}</TableHead>
                      <TableHead>{t("conversions")}</TableHead>
                      <TableHead>{t("earned")}</TableHead>
                      <TableHead>{t("link")}</TableHead>
                      <TableHead className="text-right">{tcommon("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((l: any) => (
                      <TableRow key={l.id} className={cn(!l.isActive && "opacity-50")}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 max-w-52">
                            {l.product?.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={l.product.image}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-md object-cover bg-gray-100 dark:bg-gray-800 shrink-0 cursor-zoom-in"
                                onClick={() => setLightbox({ images: [l.product.image], index: 0 })}
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                                <Store className="h-4 w-4 text-gray-400" />
                              </div>
                            )}
                            <span className="truncate min-w-0" title={l.product?.name}>
                              {shortenName(l.product?.name || "", 48)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            style={{
                              backgroundColor: `${l.platform?.color}20`,
                              color: l.platform?.color,
                            }}
                          >
                            {l.platform?.name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {l.commissionType === "FIXED"
                            ? formatCurrency(l.commissionValue)
                            : `${l.commissionValue}%`}
                        </TableCell>
                        <TableCell>{l._count?.clicks || 0}</TableCell>
                        <TableCell>{l._count?.conversions || 0}</TableCell>
                        <TableCell className="font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(l.stats?.commission || 0)}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => copyLink(l.code)}
                            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-mono"
                            title={affiliateUrl(l.code)}
                          >
                            <CopyIcon size={12} className="h-3 w-3" />
                            /aff/{l.code}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <a
                              href={affiliateUrl(l.code)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="icon" title={t("openLink")}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setShareLink(l)}
                              title={t("shareLink")}
                            >
                              <Share2 className="h-4 w-4 text-indigo-500" />
                            </Button>
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditLink(l)}
                                title={t("editLink")}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {can(role, "delete", "affiliates") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(l)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {links.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          <LinkIcon size={32} className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          {t("noLinks")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ CONVERSIONS TAB ═══ */}
        <TabsContent value="conversions" className="space-y-4">
          <Card>
            <CardContent className="p-0 sm:p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("product")}</TableHead>
                      <TableHead>{t("platform")}</TableHead>
                      <TableHead>{t("amount")}</TableHead>
                      <TableHead>{t("commission")}</TableHead>
                      <TableHead>{tcommon("status")}</TableHead>
                      <TableHead>{tcommon("date")}</TableHead>
                      {canManage && (
                        <TableHead className="text-right">{tcommon("actions")}</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversions.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium max-w-40 truncate">
                          {c.link?.product?.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            style={{
                              backgroundColor: `${c.link?.platform?.color}20`,
                              color: c.link?.platform?.color,
                            }}
                          >
                            {c.link?.platform?.name}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(c.amount)}</TableCell>
                        <TableCell className="font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(c.commissionAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge className={CONV_STATUS_STYLES[c.status]}>
                            {t(`conv_${c.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {formatDateTime(c.createdAt)}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Select
                              value={c.status}
                              onValueChange={(v) => updateConversionStatus(c.id, v)}
                            >
                              <SelectTrigger className="w-32 h-8 ml-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PENDING">{t("conv_PENDING")}</SelectItem>
                                <SelectItem value="APPROVED">{t("conv_APPROVED")}</SelectItem>
                                <SelectItem value="PAID">{t("conv_PAID")}</SelectItem>
                                <SelectItem value="REJECTED">{t("conv_REJECTED")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {conversions.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={canManage ? 7 : 6}
                          className="text-center py-8 text-gray-500"
                        >
                          <DollarSignIcon size={32} className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          {t("noConversions")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══ CONNECTION DIALOG ═══ */}
      <Dialog open={!!connPlatform} onOpenChange={(o) => !o && setConnPlatform(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {connPlatform?.name} — {t("connectionSettings")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-xs text-gray-500">{t("credentialsHint")}</p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("apiKeyLabel")}
              </label>
              <Input
                value={connForm.apiKey}
                onChange={(e) => setConnForm({ ...connForm, apiKey: e.target.value })}
                placeholder="app_key / partner_id / client_id"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("apiSecretLabel")}
              </label>
              <Input
                type="password"
                value={connForm.apiSecret}
                onChange={(e) => setConnForm({ ...connForm, apiSecret: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("accessTokenLabel")}
              </label>
              <Input
                type="password"
                value={connForm.accessToken}
                onChange={(e) => setConnForm({ ...connForm, accessToken: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t("shopIdLabel")}
                </label>
                <Input
                  value={connForm.shopId}
                  onChange={(e) => setConnForm({ ...connForm, shopId: e.target.value })}
                  placeholder="shop_id / catalog_id"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t("storeUrlLabel")}
                </label>
                <Input
                  value={connForm.storeUrl}
                  onChange={(e) => setConnForm({ ...connForm, storeUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              {connPlatform?.connection?.status === "CONNECTED" ? (
                <Button
                  variant="outline"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => {
                    const p = connPlatform;
                    setConnPlatform(null);
                    disconnect(p);
                  }}
                >
                  {t("disconnect")}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setConnPlatform(null)}>
                  {tcommon("cancel")}
                </Button>
                <Button onClick={saveConnection} disabled={connSaving}>
                  {connSaving ? t("testing") : t("saveAndTest")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ CREATE LINK DIALOG ═══ */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon size={20} className="h-5 w-5" />
              {t("createLink")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("product")}
              </label>
              <Select
                value={linkForm.productId}
                onValueChange={(v) => setLinkForm({ ...linkForm, productId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectProduct")} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="block max-w-[420px] truncate" title={p.name}>
                        {shortenName(p.name, 70)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("platform")}
              </label>
              <Select
                value={linkForm.platformId}
                onValueChange={(v) => setLinkForm({ ...linkForm, platformId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectPlatform")} />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t("commissionType")}
                </label>
                <Select
                  value={linkForm.commissionType}
                  onValueChange={(v) => setLinkForm({ ...linkForm, commissionType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">{t("percentage")}</SelectItem>
                    <SelectItem value="FIXED">{t("fixed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t("commissionValue")}
                </label>
                <Input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  value={linkForm.commissionValue}
                  onChange={(e) =>
                    setLinkForm({ ...linkForm, commissionValue: sanitizeInteger(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("targetUrlOptional")}
              </label>
              <Input
                value={linkForm.targetUrl}
                onChange={(e) => setLinkForm({ ...linkForm, targetUrl: e.target.value })}
                placeholder={t("targetUrlHint")}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                {tcommon("cancel")}
              </Button>
              <Button onClick={createLink} disabled={linkSaving}>
                {linkSaving ? tcommon("loading") : t("createLink")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ IMPORT FROM URL DIALOG ═══ */}
      <Dialog
        open={importOpen}
        onOpenChange={(o) => {
          setImportOpen(o);
          if (!o) resetImport();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon size={20} className="h-5 w-5" />
              {t("importFromUrl")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-xs text-gray-500">{t("importHint")}</p>
            <div className="flex gap-2">
              <Input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://shopee.co.id/product/..."
                onKeyDown={(e) => e.key === "Enter" && fetchPreview()}
              />
              <Button
                variant="outline"
                onClick={fetchPreview}
                disabled={!importUrl.trim() || importLoading}
              >
                {importLoading ? t("fetching") : t("fetchData")}
              </Button>
            </div>

            {importError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                <span>
                  {importError} {t("importManualHint")}
                </span>
              </div>
            )}

            {importPreview?.product && (
              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex gap-3">
                  {importForm.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={importForm.image}
                      alt={importForm.name}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-lg object-cover bg-gray-100 dark:bg-gray-800 shrink-0 cursor-zoom-in"
                      onClick={() => {
                        const imgs = importPreview.product.images?.length
                          ? importPreview.product.images
                          : [importForm.image];
                        const idx = Math.max(0, imgs.indexOf(importForm.image));
                        setLightbox({ images: imgs, index: idx });
                      }}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                      <Store className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {importPreview.platform && (
                      <Badge
                        style={{
                          backgroundColor: `${importPreview.platform.color}20`,
                          color: importPreview.platform.color,
                        }}
                      >
                        {importPreview.platform.name}
                      </Badge>
                    )}
                    {importPreview.product.fetchTier && (
                      <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                        {t("fetchedVia")}:{" "}
                        {t(TIER_KEYS[importPreview.product.fetchTier] || "tierDirect")}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {importPreview.product.images?.length > 0
                        ? `${importPreview.product.images.length} ${t("imagesFound")}`
                        : t("noImages")}
                    </p>
                  </div>
                </div>

                {/* Image gallery — click a thumbnail to set the cover, drag to reorder */}
                {importPreview.product.images?.length > 1 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      {t("chooseCover")}{" "}
                      <span className="font-normal text-gray-400">· {t("dragToReorder")}</span>
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {importPreview.product.images.map((img: string, idx: number) => (
                        <button
                          key={img}
                          type="button"
                          draggable
                          onDragStart={() => setImportDrag({ from: idx, over: null })}
                          onDragOver={(e) => {
                            if (importDrag.from === null) return;
                            e.preventDefault();
                            if (importDrag.over !== idx)
                              setImportDrag((d) => ({ ...d, over: idx }));
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (importDrag.from !== null) reorderImportImages(importDrag.from, idx);
                            setImportDrag({ from: null, over: null });
                          }}
                          onDragEnd={() => setImportDrag({ from: null, over: null })}
                          onClick={() => setImportForm({ ...importForm, image: img })}
                          className={cn(
                            "shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-move",
                            importForm.image === img
                              ? "border-indigo-500 ring-2 ring-indigo-500/30"
                              : "border-transparent hover:border-gray-300 dark:hover:border-gray-600",
                            importDrag.from === idx && "opacity-40",
                            importDrag.over === idx &&
                              importDrag.from !== idx &&
                              "ring-2 ring-indigo-400 scale-95",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 object-cover bg-gray-100 dark:bg-gray-800 pointer-events-none"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(importPreview?.product || importError) && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t("product")}
                  </label>
                  <Input
                    value={importForm.name}
                    onChange={(e) => setImportForm({ ...importForm, name: e.target.value })}
                    placeholder={t("productNamePlaceholder")}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {t("priceLabel")}
                    </label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step={1}
                      value={importForm.price}
                      onChange={(e) =>
                        setImportForm({ ...importForm, price: sanitizeInteger(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {t("commissionType")}
                    </label>
                    <Select
                      value={importForm.commissionType}
                      onValueChange={(v) => setImportForm({ ...importForm, commissionType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENTAGE">{t("percentage")}</SelectItem>
                        <SelectItem value="FIXED">{t("fixed")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {t("commissionValue")}
                    </label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step={1}
                      value={importForm.commissionValue}
                      onChange={(e) =>
                        setImportForm({
                          ...importForm,
                          commissionValue: sanitizeInteger(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setImportOpen(false);
                  resetImport();
                }}
              >
                {tcommon("cancel")}
              </Button>
              <Button
                onClick={importLink}
                disabled={importSaving || (!importForm.name && !importUrl.trim())}
              >
                {importSaving ? tcommon("loading") : t("createLink")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* ═══ EDIT LINK DIALOG ═══ */}
      <Dialog open={!!editLink} onOpenChange={(o) => !o && setEditLink(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              {t("editLink")}
            </DialogTitle>
          </DialogHeader>
          {editLink && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                {editLink.product?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={editLink.product.image}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    <Store className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" title={editLink.product?.name}>
                    {shortenName(editLink.product?.name || "", 50)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {editLink.platform?.name} · /aff/{editLink.code}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t("commissionType")}
                  </label>
                  <Select
                    value={editForm.commissionType}
                    onValueChange={(v) => setEditForm({ ...editForm, commissionType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">{t("percentage")}</SelectItem>
                      <SelectItem value="FIXED">{t("fixed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t("commissionValue")}
                  </label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    value={editForm.commissionValue}
                    onChange={(e) =>
                      setEditForm({ ...editForm, commissionValue: sanitizeInteger(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t("targetUrl")}
                </label>
                <Input
                  value={editForm.targetUrl}
                  onChange={(e) => setEditForm({ ...editForm, targetUrl: e.target.value })}
                />
              </div>
              <label className="flex items-center justify-between gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer">
                <span className="text-sm">{t("linkActive")}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-500 cursor-pointer"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditLink(null)}>
                  {tcommon("cancel")}
                </Button>
                <Button onClick={saveEditLink} disabled={editSaving}>
                  {editSaving ? tcommon("loading") : tcommon("save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE CONFIRM DIALOG ═══ */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              {t("deleteLinkTitle")}
            </DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                {deleteTarget.product?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={deleteTarget.product.image}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    <Store className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" title={deleteTarget.product?.name}>
                    {shortenName(deleteTarget.product?.name || "", 50)}
                  </p>
                  <p className="text-xs text-gray-500">{deleteTarget.platform?.name}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t("deleteLinkWarning")}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                  {tcommon("cancel")}
                </Button>
                <Button variant="destructive" onClick={confirmDeleteLink} disabled={deleteSaving}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {deleteSaving ? tcommon("loading") : tcommon("delete")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Share link dialog (QR + social) */}
      <ShareLinkDialog
        open={!!shareLink}
        onClose={() => setShareLink(null)}
        url={shareLink ? affiliateUrl(shareLink.code) : ""}
        productName={shareLink?.product?.name}
      />

      {/* Fullscreen image viewer */}
      <Lightbox
        images={lightbox?.images || []}
        index={lightbox ? lightbox.index : null}
        onClose={() => setLightbox(null)}
        onIndexChange={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
      />
    </motion.div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          {icon}
        </div>
        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
