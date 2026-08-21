"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  ShieldOff,
  Trash2,
  XCircle,
} from "lucide-react";
import { CopyIcon, LinkIcon, ShieldCheckIcon } from "lucide-animated";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import { buildAcsUrl, buildMetadataUrl, buildTestLoginUrl, validateSsoForm } from "@/lib/sso";

interface SsoConnection {
  id: string;
  name: string;
  entryPoint: string;
  spIssuer: string;
  emailDomain: string | null;
  enabled: boolean;
  idpCertConfigured: boolean;
  tenantSlug: string | null;
}

type LoadState =
  { status: "loading" } | { status: "empty" } | { status: "ready"; conn: SsoConnection };

export function SsoSettings() {
  const t = useTranslations("sso");
  const tcommon = useTranslations("common");
  const confirm = useConfirm();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEntryPoint, setFormEntryPoint] = useState("");
  const [formCert, setFormCert] = useState("");
  const [formSpIssuer, setFormSpIssuer] = useState("");
  const [formEmailDomain, setFormEmailDomain] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/saml/connections", { cache: "no-store" });
      if (!res.ok) {
        toast.error(t("loadFailed"));
        setState({ status: "empty" });
        return;
      }
      const data = await res.json();
      if (!data) {
        setState({ status: "empty" });
      } else {
        setState({ status: "ready", conn: data });
      }
    } catch {
      toast.error(t("loadFailed"));
      setState({ status: "empty" });
    }
  }, [t]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const resetForm = () => {
    setFormName("");
    setFormEntryPoint("");
    setFormCert("");
    setFormSpIssuer("");
    setFormEmailDomain("");
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = () => {
    if (state.status !== "ready") return;
    setFormName(state.conn.name);
    setFormEntryPoint(state.conn.entryPoint);
    setFormCert("");
    setFormSpIssuer(state.conn.spIssuer);
    setFormEmailDomain(state.conn.emailDomain || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const errorKey = validateSsoForm(
      {
        name: formName,
        entryPoint: formEntryPoint,
        idpCert: formCert,
        spIssuer: formSpIssuer,
        emailDomain: formEmailDomain,
      },
      state.status === "ready",
    );
    if (errorKey) {
      toast.error(t(errorKey));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/saml/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          entryPoint: formEntryPoint.trim(),
          idpCert: formCert.trim(),
          spIssuer: formSpIssuer.trim() || undefined,
          emailDomain: formEmailDomain.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || t("failedToast"));
        return;
      }
      toast.success(t("savedToast"));
      setDialogOpen(false);
      resetForm();
      await load();
    } catch {
      toast.error(t("failedToast"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (state.status !== "ready") return;
    setToggling(true);
    try {
      const res = await fetch("/api/auth/saml/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !state.conn.enabled }),
      });
      if (!res.ok) {
        toast.error(t("toggleFailedToast"));
        return;
      }
      await load();
    } catch {
      toast.error(t("toggleFailedToast"));
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: t("deleteTitle"),
      description: t("deleteDesc"),
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/auth/saml/connections", { method: "DELETE" });
      if (!res.ok) {
        toast.error(t("failedToast"));
        return;
      }
      toast.success(t("deletedToast"));
      setState({ status: "empty" });
    } catch {
      toast.error(t("failedToast"));
    } finally {
      setDeleting(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("copied"));
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const conn = state.status === "ready" ? state.conn : null;
  const metadataUrl = buildMetadataUrl(origin, conn?.tenantSlug);
  const acsUrl = buildAcsUrl(origin);
  const entityId = conn?.spIssuer || "next-dashboard";
  const testLoginUrl = buildTestLoginUrl(conn?.tenantSlug);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
      </div>

      {state.status === "loading" ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : state.status === "empty" ? (
        /* ── Empty state: no SSO connection ───────────────────────────── */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4">
                <Building2 className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">
                {t("notConfiguredTitle")}
              </h3>
              <p className="text-sm text-gray-400 mt-1 max-w-md">{t("notConfiguredDesc")}</p>
              <Button className="mt-6" onClick={openCreate}>
                <Building2 className="h-4 w-4 mr-2" /> {t("configureSso")}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : conn ? (
        <>
          {/* ── Status banner ───────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6"
          >
            <div
              className={`absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none ${
                conn.enabled ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    conn.enabled
                      ? "bg-emerald-50 dark:bg-emerald-900/20"
                      : "bg-amber-50 dark:bg-amber-900/20"
                  }`}
                >
                  {conn.enabled ? (
                    <ShieldCheckIcon size={24} className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <ShieldOff className="h-6 w-6 text-amber-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {conn.name}
                    </p>
                    <Badge variant={conn.enabled ? "success" : "warning"}>
                      {conn.enabled ? t("enabled") : t("disabled")}
                    </Badge>
                    <Badge variant={conn.idpCertConfigured ? "info" : "danger"}>
                      {conn.idpCertConfigured ? t("certConfigured") : t("certMissing")}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {conn.enabled
                      ? conn.emailDomain
                        ? t("activeDesc", { domain: conn.emailDomain })
                        : t("activeNoDomainDesc")
                      : t("notEnabledDesc")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Pencil className="h-4 w-4 mr-2" /> {t("edit")}
                </Button>
                <Button variant="outline" size="sm" onClick={handleToggle} disabled={toggling}>
                  {toggling ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : conn.enabled ? (
                    <XCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  {conn.enabled ? t("disableSso") : t("enableSso")}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                  {deleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  {t("delete")}
                </Button>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            {/* ── Connection details ─────────────────────────────────────── */}
            <div className="lg:col-span-3 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    <CardTitle>{t("connectionTitle")}</CardTitle>
                  </div>
                  <CardDescription>{t("connectionDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t("providerLabel")}
                      </p>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{conn.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t("emailDomainLabel")}
                      </p>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                        {conn.emailDomain || "—"}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t("entryPointLabel")}
                      </p>
                      <code className="mt-1 block text-sm font-mono text-gray-900 dark:text-gray-100 break-all bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {conn.entryPoint}
                      </code>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t("spIssuerLabel")}
                      </p>
                      <code className="mt-1 block text-sm font-mono text-gray-900 dark:text-gray-100 break-all bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {conn.spIssuer}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t("enableSso")}
                      </p>
                      <p className="text-xs text-gray-500">{t("enabledHint")}</p>
                    </div>
                    <Switch
                      checked={conn.enabled}
                      onCheckedChange={handleToggle}
                      disabled={toggling}
                      aria-label={t("enableSso")}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── SP metadata ────────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <LinkIcon size={20} className="h-5 w-5 text-indigo-500" />
                    <CardTitle>{t("metadataTitle")}</CardTitle>
                  </div>
                  <CardDescription>{t("metadataDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">
                      {t("metadataUrlLabel")}
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono break-all">
                        {metadataUrl}
                      </code>
                      <Button variant="ghost" size="sm" onClick={() => copyText(metadataUrl)}>
                        <CopyIcon size={14} className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">{t("acsUrlLabel")}</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono break-all">
                        {acsUrl}
                      </code>
                      <Button variant="ghost" size="sm" onClick={() => copyText(acsUrl)}>
                        <CopyIcon size={14} className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">{t("entityIdLabel")}</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono break-all">
                        {entityId}
                      </code>
                      <Button variant="ghost" size="sm" onClick={() => copyText(entityId)}>
                        <CopyIcon size={14} className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <Button variant="outline" size="sm" asChild>
                      <a href={metadataUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" /> {t("openMetadata")}
                      </a>
                    </Button>
                    {testLoginUrl && conn.enabled && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={testLoginUrl} target="_blank" rel="noopener noreferrer">
                          <ShieldCheckIcon size={16} className="h-4 w-4 mr-2" /> {t("testLogin")}
                        </a>
                      </Button>
                    )}
                  </div>
                  {testLoginUrl && <p className="text-xs text-gray-400">{t("testLoginHint")}</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : null}

      {/* ── Setup / Edit dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              {state.status === "ready" ? t("editTitle") : t("setupTitle")}
            </DialogTitle>
            <DialogDescription>
              {state.status === "ready" ? t("editDesc") : t("setupDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[65vh] overflow-y-auto scrollbar-thin">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("nameLabel")}</label>
              <Input
                placeholder={t("namePlaceholder")}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("entryPointLabel")}</label>
              <Input
                type="url"
                placeholder={t("entryPointPlaceholder")}
                value={formEntryPoint}
                onChange={(e) => setFormEntryPoint(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">{t("entryPointHint")}</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("certLabel")}</label>
              <Textarea
                rows={4}
                placeholder={t("certPlaceholder")}
                value={formCert}
                onChange={(e) => setFormCert(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-gray-400 mt-1">{t("certHelp")}</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("spIssuerLabel")}</label>
              <Input
                placeholder={t("spIssuerPlaceholder")}
                value={formSpIssuer}
                onChange={(e) => setFormSpIssuer(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("emailDomainLabel")}</label>
              <Input
                placeholder={t("emailDomainPlaceholder")}
                value={formEmailDomain}
                onChange={(e) => setFormEmailDomain(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">{t("emailDomainHelp")}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              {tcommon("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("saving")}
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 mr-2" /> {t("save")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
