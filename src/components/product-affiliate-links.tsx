"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Share2, Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import { PlusIcon, CopyIcon } from "lucide-animated";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, sanitizeInteger } from "@/lib/utils";
import { ShareLinkDialog } from "@/components/share-link-dialog";
import { toast } from "sonner";

interface ProductAffiliateLinksProps {
  productId: string;
  canManage: boolean;
  canDelete: boolean;
}

/**
 * Product-side affiliate link manager: shows every platform and lets the user
 * link/unlink this product per platform (the inverse of the link-centric
 * affiliates page). Reuses the existing affiliate link APIs.
 */
export function ProductAffiliateLinks({
  productId,
  canManage,
  canDelete,
}: ProductAffiliateLinksProps) {
  const t = useTranslations("affiliates");
  const tcommon = useTranslations("common");

  const [platforms, setPlatforms] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, { type: string; value: string }>>({});
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [shareTarget, setShareTarget] = useState<any>(null);

  const load = useCallback(() => {
    return Promise.all([
      fetch("/api/affiliates/platforms").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/affiliates/links").then((r) => (r.ok ? r.json() : [])),
    ]).then(([p, l]) => {
      setPlatforms(Array.isArray(p) ? p : []);
      setLinks((Array.isArray(l) ? l : []).filter((x: any) => x.product?.id === productId));
      setLoading(false);
    });
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const linkFor = (platformId: string) => links.find((l) => l.platform?.id === platformId);
  const affiliateUrl = (code: string) => `${origin}/api/aff/${code}`;
  const copyLink = (code: string) => {
    navigator.clipboard.writeText(affiliateUrl(code));
    toast.success(t("linkCopied"));
  };

  const addLink = async (platform: any) => {
    const f = form[platform.id] || { type: "PERCENTAGE", value: "10" };
    setBusy(platform.id);
    const res = await fetch("/api/affiliates/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        platformId: platform.id,
        commissionType: f.type,
        commissionValue: f.value,
      }),
    });
    setBusy(null);
    if (res.ok) {
      toast.success(t("linkCreated"));
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || tcommon("error"));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/affiliates/links/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      toast.success(t("linkDeleted"));
      setDeleteTarget(null);
      load();
    } else {
      toast.error(tcommon("error"));
    }
  };

  return (
    <Card id="platform-links" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          {t("managePlatformLinks")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="h-32 shimmer rounded" />
        ) : platforms.length === 0 ? (
          <p className="text-sm text-gray-500">{tcommon("noData")}</p>
        ) : (
          platforms.map((pf) => {
            const link = linkFor(pf.id);
            const f = form[pf.id] || { type: "PERCENTAGE", value: "10" };
            return (
              <div
                key={pf.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-semibold shrink-0"
                  style={{ backgroundColor: pf.color || "#6366f1" }}
                >
                  {pf.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{pf.name}</p>
                  {link ? (
                    <p className="text-xs text-gray-500">
                      {link.commissionType === "FIXED"
                        ? formatCurrency(link.commissionValue)
                        : `${link.commissionValue}%`}{" "}
                      · {link._count?.clicks || 0} {t("clicks")}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">{t("notLinked")}</p>
                  )}
                </div>

                {link ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {t("linked")}
                    </Badge>
                    <button
                      onClick={() => copyLink(link.code)}
                      title={affiliateUrl(link.code)}
                      className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    >
                      <CopyIcon size={14} className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={affiliateUrl(link.code)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => setShareTarget(link)}
                      title={t("shareLink")}
                      className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setDeleteTarget(link)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                        title={tcommon("delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    )}
                  </div>
                ) : canManage ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      type="number"
                      inputMode="numeric"
                      step={1}
                      value={f.value}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [pf.id]: { ...f, value: sanitizeInteger(e.target.value) },
                        })
                      }
                      className="w-16 h-8"
                    />
                    <Select
                      value={f.type}
                      onValueChange={(v) => setForm({ ...form, [pf.id]: { ...f, type: v } })}
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENTAGE">%</SelectItem>
                        <SelectItem value="FIXED">{t("fixed")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addLink(pf)}
                      disabled={busy === pf.id}
                    >
                      <PlusIcon size={14} className="h-3.5 w-3.5 mr-1" />
                      {t("addLink")}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>

      {/* Delete confirmation modal */}
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
              <p className="text-sm">
                <span className="font-medium">{deleteTarget.platform?.name}</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t("deleteLinkWarning")}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                  {tcommon("cancel")}
                </Button>
                <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {deleting ? tcommon("loading") : tcommon("delete")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Share link dialog (QR + social) */}
      <ShareLinkDialog
        open={!!shareTarget}
        onClose={() => setShareTarget(null)}
        url={shareTarget ? affiliateUrl(shareTarget.code) : ""}
        productName={shareTarget?.platform?.name}
      />
    </Card>
  );
}
